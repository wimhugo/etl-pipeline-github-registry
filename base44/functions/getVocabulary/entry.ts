import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import yaml from 'npm:js-yaml@4.1.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { vocabularyId } = await req.json();
    
    if (!vocabularyId) {
      return Response.json({ error: 'vocabularyId is required' }, { status: 400 });
    }

    // Fetch vocabulary source configuration
    const vocabSources = await base44.entities.VocabularySource.filter({ id: vocabularyId, is_active: true });
    if (vocabSources.length === 0) {
      return Response.json({ error: 'Vocabulary source not found or inactive' }, { status: 404 });
    }

    const vocabSource = vocabSources[0];
    
    // Check cache
    const now = new Date();
    if (vocabSource.last_fetched_at && vocabSource.cache_duration_minutes) {
      const lastFetched = new Date(vocabSource.last_fetched_at);
      const cacheExpiry = new Date(lastFetched.getTime() + vocabSource.cache_duration_minutes * 60000);
      if (now < cacheExpiry && vocabSource.last_fetch_status === 'success') {
        // Return cached data from inline_data or last known state
        if (vocabSource.inline_data) {
          try {
            const cached = JSON.parse(vocabSource.inline_data);
            // Only use cache if it has actual data
            if (cached && Array.isArray(cached) && cached.length > 0) {
              return Response.json({ 
                vocabulary: vocabSource.name,
                items: cached,
                cached: true
              });
            }
          } catch (e) {
            // Cache invalid, continue to fetch
          }
        }
      }
    }

    let rawData = null;
    let fetchError = null;

    // Fetch data based on source type
    try {
      if (vocabSource.source_type === 'inline') {
        if (!vocabSource.inline_data) {
          throw new Error('No inline data provided');
        }
        rawData = JSON.parse(vocabSource.inline_data);
      } 
      else if (vocabSource.source_type === 'url') {
        if (!vocabSource.source_url) {
          throw new Error('No source URL provided');
        }
        const response = await fetch(vocabSource.source_url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        
        if (vocabSource.data_format === 'yaml' || contentType.includes('yaml') || contentType.includes('yml')) {
          rawData = yaml.load(text);
        } else if (vocabSource.data_format === 'ttl' || contentType.includes('turtle')) {
          // For TTL, we'll store as-is and let the frontend handle parsing
          // Or we could use a TTL parser library if needed
          rawData = { raw: text, format: 'ttl' };
        } else {
          rawData = JSON.parse(text);
        }
      } 
      else if (vocabSource.source_type === 'github') {
        if (!vocabSource.github_repo || !vocabSource.github_path) {
          throw new Error('GitHub repo and path are required');
        }
        
        // Extract owner/repo from full URL if needed (handle both "owner/repo" and "https://github.com/owner/repo/")
        let repo = vocabSource.github_repo;
        if (repo.includes('github.com')) {
          const match = repo.match(/github\.com[/:]([^/]+)\/([^/]+)/);
          if (match) {
            repo = `${match[1]}/${match[2]}`;
          }
        }
        
        const path = vocabSource.github_path;
        const branch = vocabSource.github_branch || 'main';
        
        // Fetch GitHub token from GlobalConfig
        const globalConfigs = await base44.entities.GlobalConfig.list();
        const globalConfig = globalConfigs[0] || {};
        const token = globalConfig.github_token;
        
        // Use GitHub API to fetch file content
        const githubUrl = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
        const headers = {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'OpenREL-App'
        };
        
        // Add token if available (classic PAT uses 'token' prefix, not 'Bearer')
        if (token) {
          headers['Authorization'] = `token ${token}`;
        }
        
        const response = await fetch(githubUrl, { headers });
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
        const fileData = await response.json();
        const content = atob(fileData.content); // Decode base64
        
        if (vocabSource.data_format === 'yaml') {
          rawData = yaml.load(content);
        } else if (vocabSource.data_format === 'ttl') {
          rawData = { raw: content, format: 'ttl' };
        } else {
          rawData = JSON.parse(content);
        }
      }
    } catch (error) {
      fetchError = error.message;
      // Update fetch status
      await base44.entities.VocabularySource.update(vocabularyId, {
        last_fetch_status: 'failed',
        last_fetched_at: now.toISOString()
      });
      
      return Response.json({ 
        error: `Failed to fetch vocabulary: ${fetchError}`,
        vocabulary: vocabSource.name
      }, { status: 500 });
    }

    // Extract items using json_path_expression
    let items = [];
    if (vocabSource.json_path_expression) {
      items = extractFromPath(rawData, vocabSource.json_path_expression);
    } else {
      // If no path expression, assume rawData is the array
      items = Array.isArray(rawData) ? rawData : [rawData];
    }

    // Normalize to { value, label } format
    const normalizedItems = items.map(item => {
      if (typeof item === 'string' || typeof item === 'number') {
        return { value: String(item), label: String(item) };
      }
      if (typeof item === 'object') {
        const valueField = vocabSource.value_field || 'id';
        const labelField = vocabSource.label_field || 'label';
        return {
          value: item[valueField] || item.id || item.value || '',
          label: item[labelField] || item.label || item.name || item.title || String(item[valueField] || item.id || '')
        };
      }
      return { value: '', label: '' };
    }).filter(item => item.value && item.label);

    // Update cache
    await base44.entities.VocabularySource.update(vocabularyId, {
      last_fetched_at: now.toISOString(),
      last_fetch_status: 'success',
      inline_data: JSON.stringify(items) // Cache the raw items
    });

    return Response.json({
      vocabulary: vocabSource.name,
      items: normalizedItems,
      cached: false,
      source_type: vocabSource.source_type,
      data_format: vocabSource.data_format
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Simple JSONPath-like extractor
 * Supports: $.property, $.array[*], $.nested.property
 */
function extractFromPath(data, path) {
  if (!path || !data) return [];
  
  // Remove leading $ if present
  const cleanPath = path.replace(/^\$\./, '');
  
  // Handle array notation [*]
  if (cleanPath.includes('[*]')) {
    const parts = cleanPath.split('[*]');
    const basePath = parts[0];
    const remainingPath = parts.slice(1).join('[*]');
    
    let baseData = basePath ? getPathValue(data, basePath) : data;
    if (!Array.isArray(baseData)) return [];
    
    if (remainingPath) {
      return baseData.flatMap(item => extractFromPath(item, remainingPath));
    }
    return baseData;
  }
  
  // Simple dot notation
  return getPathValue(data, cleanPath) || [];
}

function getPathValue(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}