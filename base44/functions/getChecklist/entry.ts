import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import yaml from 'npm:js-yaml@4.1.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { checklist_source_id } = await req.json();
    
    if (!checklist_source_id) {
      return Response.json({ error: 'checklist_source_id is required' }, { status: 400 });
    }

    // Fetch checklist source configuration
    const checklistSources = await base44.entities.ChecklistSource.filter({ id: checklist_source_id, is_active: true });
    if (checklistSources.length === 0) {
      return Response.json({ error: 'Checklist source not found or inactive' }, { status: 404 });
    }

    const checklistSource = checklistSources[0];
    
    // Check cache
    const now = new Date();
    if (checklistSource.last_fetched_at && checklistSource.cache_duration_minutes) {
      const lastFetched = new Date(checklistSource.last_fetched_at);
      const cacheExpiry = new Date(lastFetched.getTime() + checklistSource.cache_duration_minutes * 60000);
      if (now < cacheExpiry && checklistSource.last_fetch_status === 'success') {
        if (checklistSource.inline_data) {
          try {
            const cached = JSON.parse(checklistSource.inline_data);
            if (cached && Array.isArray(cached) && cached.length > 0) {
              return Response.json({ 
                checklist: checklistSource.name,
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
      if (checklistSource.source_type === 'inline') {
        if (!checklistSource.inline_data) {
          throw new Error('No inline data provided');
        }
        rawData = JSON.parse(checklistSource.inline_data);
      } 
      else if (checklistSource.source_type === 'url') {
        if (!checklistSource.source_url) {
          throw new Error('No source URL provided');
        }
        const response = await fetch(checklistSource.source_url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        
        if (checklistSource.data_format === 'yaml' || contentType.includes('yaml') || contentType.includes('yml')) {
          rawData = yaml.load(text);
        } else if (checklistSource.data_format === 'ttl' || contentType.includes('turtle')) {
          rawData = { raw: text, format: 'ttl' };
        } else {
          rawData = JSON.parse(text);
        }
      } 
      else if (checklistSource.source_type === 'github') {
        if (!checklistSource.github_repo || !checklistSource.github_path) {
          throw new Error('GitHub repo and path are required');
        }
        
        let repo = checklistSource.github_repo;
        if (repo.includes('github.com')) {
          const match = repo.match(/github\.com[/:]([^/]+)\/([^/]+)/);
          if (match) {
            repo = `${match[1]}/${match[2]}`;
          }
        }
        
        const path = checklistSource.github_path;
        const branch = checklistSource.github_branch || 'main';
        
        const globalConfigs = await base44.entities.GlobalConfig.list();
        const globalConfig = globalConfigs[0] || {};
        const token = globalConfig.github_token;
        
        const githubUrl = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
        const headers = {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'OpenREL-App'
        };
        
        if (token) {
          headers['Authorization'] = `token ${token}`;
        }
        
        const response = await fetch(githubUrl, { headers });
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
        const fileData = await response.json();
        const content = atob(fileData.content);
        
        if (checklistSource.data_format === 'yaml') {
          rawData = yaml.load(content);
        } else if (checklistSource.data_format === 'ttl') {
          rawData = { raw: content, format: 'ttl' };
        } else {
          rawData = JSON.parse(content);
        }
      }
    } catch (error) {
      fetchError = error.message;
      await base44.entities.ChecklistSource.update(checklist_source_id, {
        last_fetch_status: 'failed',
        last_fetched_at: now.toISOString()
      });
      
      return Response.json({ 
        error: `Failed to fetch checklist: ${fetchError}`,
        checklist: checklistSource.name
      }, { status: 500 });
    }

    // Extract items using json_path_expression
    let items = [];
    if (checklistSource.json_path_expression) {
      items = extractFromPath(rawData, checklistSource.json_path_expression);
    } else {
      items = Array.isArray(rawData) ? rawData : [rawData];
    }

    // Normalize to { id, label, description } format
    const normalizedItems = items.map(item => {
      if (typeof item === 'string' || typeof item === 'number') {
        return { id: String(item), label: String(item), description: '' };
      }
      if (typeof item === 'object') {
        const idField = checklistSource.value_field || 'id';
        const labelField = checklistSource.label_field || 'label';
        const descField = checklistSource.description_field || 'description';
        return {
          id: item[idField] || item.id || '',
          label: item[labelField] || item.label || item.name || item.title || String(item[idField] || ''),
          description: item[descField] || item.description || ''
        };
      }
      return { id: '', label: '', description: '' };
    }).filter(item => item.id && item.label);

    // Update cache
    await base44.entities.ChecklistSource.update(checklist_source_id, {
      last_fetched_at: now.toISOString(),
      last_fetch_status: 'success',
      inline_data: JSON.stringify(items)
    });

    return Response.json({
      checklist: checklistSource.name,
      items: normalizedItems,
      cached: false,
      source_type: checklistSource.source_type,
      data_format: checklistSource.data_format
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function extractFromPath(data, path) {
  if (!path || !data) return [];
  
  const cleanPath = path.replace(/^\$\./, '');
  
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
  
  return getPathValue(data, cleanPath) || [];
}

function getPathValue(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}