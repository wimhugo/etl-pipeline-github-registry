import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import yaml from 'npm:js-yaml@4.1.0';

Deno.serve(async (req) => {
  console.log('📥 getChecklist called');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    console.log('👤 User:', user?.email || 'no user');
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { checklist_source_id } = await req.json();
    console.log('📦 Checklist source ID:', checklist_source_id);
    
    if (!checklist_source_id) {
      return Response.json({ error: 'checklist_source_id is required' }, { status: 400 });
    }

    // Fetch checklist source configuration
    const checklistSources = await base44.entities.ChecklistSource.filter({ id: checklist_source_id, is_active: true });
    console.log('📊 Checklist sources found:', checklistSources.length);
    if (checklistSources.length === 0) {
      return Response.json({ error: 'Checklist source not found or inactive' }, { status: 404 });
    }

    const checklistSource = checklistSources[0];
    console.log('📋 Checklist source:', JSON.stringify({
      name: checklistSource.name,
      source_type: checklistSource.source_type,
      github_repo: checklistSource.github_repo,
      github_path: checklistSource.github_path,
      github_branch: checklistSource.github_branch,
      data_format: checklistSource.data_format
    }, null, 2));
    
    // Check cache - invalidate if schema changed (regex_field added) or if cache is corrupted
    const now = new Date();
    if (checklistSource.last_fetched_at && checklistSource.cache_duration_minutes) {
      const lastFetched = new Date(checklistSource.last_fetched_at);
      const cacheExpiry = new Date(lastFetched.getTime() + checklistSource.cache_duration_minutes * 60000);
      if (now < cacheExpiry && checklistSource.last_fetch_status === 'success') {
        if (checklistSource.inline_data) {
          try {
            console.log('📦 Checking cache, inline_data length:', checklistSource.inline_data.length);
            const cached = JSON.parse(checklistSource.inline_data);
            if (cached && Array.isArray(cached) && cached.length > 0) {
              // Validate cache has the new schema (regex field)
              const hasNewSchema = cached.every(item => item.hasOwnProperty('regex'));
              if (hasNewSchema) {
                console.log('✅ Cache hit, returning', cached.length, 'items');
                return Response.json({ 
                  checklist: checklistSource.name,
                  items: cached,
                  cached: true
                });
              }
              // Schema mismatch - invalidate cache and re-fetch
              console.log('Cache invalidated due to schema change (missing regex field)');
            }
          } catch (e) {
            console.log('⚠️ Cache corrupted, will re-fetch:', e.message);
            // Cache invalid, continue to fetch
          }
        }
      }
    }

    let rawData = null;
    let fetchError = null;

    console.log('🚀 Starting data fetch, source_type:', checklistSource.source_type);
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
        console.log('📁 Original repo value:', repo);
        // Handle full GitHub URLs with various formats
        if (repo.includes('github.com')) {
          const match = repo.match(/github\.com[/:]([^/]+)\/([^/\s]+)/);
          console.log('🔍 Regex match result:', match);
          if (match) {
            repo = `${match[1]}/${match[2]}`;
            console.log('✅ Parsed repo:', repo);
          } else {
            console.log('❌ Regex failed to match');
            throw new Error('Invalid GitHub repository URL format. Expected: owner/repo or https://github.com/owner/repo');
          }
        } else {
          console.log('✅ Repo already in owner/repo format:', repo);
        }
        
        const path = checklistSource.github_path;
        const branch = checklistSource.github_branch || 'main';
        
        // Fetch GitHub token using service role (more reliable)
        let token = null;
        try {
          console.log('🔍 Fetching GlobalConfig...');
          const globalConfigs = await base44.asServiceRole.entities.GlobalConfig.filter({});
          console.log('📊 GlobalConfig count:', globalConfigs?.length || 0);
          console.log('📊 GlobalConfig[0] fields:', globalConfigs?.[0] ? Object.keys(globalConfigs[0]) : 'no configs');
          if (globalConfigs && globalConfigs.length > 0 && globalConfigs[0].github_token) {
            token = globalConfigs[0].github_token;
            console.log('✅ Token found in GlobalConfig (first 8 chars):', token.substring(0, 8) + '...');
            console.log('✅ Token length:', token.length);
            console.log('✅ Token starts with ghp_:', token.startsWith('ghp_'));
          } else {
            console.log('⚠️ No github_token in GlobalConfig');
          }
        } catch (e) {
          console.log('❌ Could not fetch GlobalConfig:', e.message, e.stack);
        }
        
        // Fallback to environment variable
        if (!token) {
          token = Deno.env.get('GITHUB_TOKEN');
          console.log('ℹ️ Token from env var (first 8 chars):', token ? token.substring(0, 8) + '...' : 'not set');
        }
        
        if (!token) {
          console.log('❌ No GitHub token found anywhere');
          throw new Error('No GitHub token configured in GlobalConfig or environment');
        }
        
        console.log('🔑 Final token (first 8 chars):', token.substring(0, 8) + '...');
        console.log('🔑 Token length:', token.length);
        
        const githubUrl = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
        console.log('🌐 GitHub API URL:', githubUrl);
        const headers = {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'OpenREL-App'
        };
        console.log('🔑 Authorization header:', headers.Authorization);
        
        // Use raw GitHub URL for direct content access (avoids base64 encoding issues)
        const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
        console.log('🌐 Raw GitHub URL:', rawUrl);
        
        console.log('📡 Fetching from GitHub (raw)...');
        const response = await fetch(rawUrl, { headers });
        console.log('📡 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
          const errorData = await response.text().catch(() => '');
          console.log('❌ GitHub error response:', errorData);
          throw new Error(`GitHub API error (${response.status}): ${errorData}`);
        }
        
        const content = await response.text();
        console.log('📦 Content length:', content.length);
        console.log('📦 Content (first 200 chars):', content.substring(0, 200));
        console.log('📦 Data format:', checklistSource.data_format);
        
        if (checklistSource.data_format === 'yaml') {
          console.log('📄 Parsing as YAML...');
          rawData = yaml.load(content);
        } else if (checklistSource.data_format === 'ttl') {
          console.log('📄 Parsing as TTL...');
          rawData = { raw: content, format: 'ttl' };
        } else {
          console.log('📄 Parsing as JSON...');
          console.log('📄 Content length:', content.length);
          console.log('📄 First 100 chars:', content.substring(0, 100));
          
          // The source file has LaTeX-style escaping throughout (backslash before special chars)
          // Simple approach: remove ALL backslashes since none are legitimate in this broken JSON
          console.log('🧹 Cleaning content - removing all backslashes...');
          const cleanedContent = content.replace(/\\/g, '');
          console.log('🧹 Cleaned content length:', cleanedContent.length);
          
          console.log('📄 Cleaned first 100 chars:', cleanedContent.substring(0, 100));
          console.log('📄 About to parse JSON...');
          try {
            rawData = JSON.parse(cleanedContent);
            console.log('✅ JSON parsed successfully');
            console.log('✅ Items found:', Array.isArray(rawData.items) ? rawData.items.length : 'N/A');
          } catch (parseError) {
            console.log('❌ JSON parse error:', parseError.message);
            console.log('❌ Parse error stack:', parseError.stack);
            throw new Error(`Invalid JSON: ${parseError.message}`);
          }
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

    // Normalize to { id, label, description, regex } format
    const normalizedItems = items.map(item => {
      if (typeof item === 'string' || typeof item === 'number') {
        return { id: String(item), label: String(item), description: '', regex: [] };
      }
      if (typeof item === 'object') {
        const idField = checklistSource.value_field || 'id';
        const labelField = checklistSource.label_field || 'label';
        const descField = checklistSource.description_field || 'description';
        const regexField = checklistSource.regex_field || 'regex';
        const regexValue = item[regexField];
        return {
          id: item[idField] || item.id || '',
          label: item[labelField] || item.label || item.name || item.title || String(item[idField] || ''),
          description: item[descField] || item.description || '',
          regex: Array.isArray(regexValue) ? regexValue : []
        };
      }
      return { id: '', label: '', description: '', regex: [] };
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