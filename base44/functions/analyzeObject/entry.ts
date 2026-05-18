import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inputType, objectUrl, textContent, fileUrl } = await req.json();

    let content = '';
    let sourceInfo = '';

    // Handle different input types
    if (inputType === 'url') {
      if (!objectUrl || typeof objectUrl !== 'string') {
        return Response.json({ error: 'Object URL is required' }, { status: 400 });
      }

      // Validate URL format
      try {
        new URL(objectUrl);
      } catch (err) {
        return Response.json({ error: 'Invalid URL format' }, { status: 400 });
      }

      // Fetch the object from the URL
      const response = await fetch(objectUrl, {
        headers: {
          'Accept': 'application/json, application/ld+json, text/html, text/plain, */*',
        },
      });

      if (!response.ok) {
        return Response.json({ 
          error: `Failed to fetch object: ${response.status} ${response.statusText}` 
        }, { status: 400 });
      }

      const contentType = response.headers.get('content-type') || '';
      sourceInfo = `URL: ${objectUrl} (${contentType})`;
      content = await response.text();
    } else if (inputType === 'text') {
      if (!textContent || typeof textContent !== 'string') {
        return Response.json({ error: 'Text content is required' }, { status: 400 });
      }
      sourceInfo = 'Text input';
      content = textContent;
    } else if (inputType === 'file') {
      if (!fileUrl) {
        return Response.json({ error: 'File URL is required' }, { status: 400 });
      }
      // Fetch the uploaded file
      const response = await fetch(fileUrl);
      if (!response.ok) {
        return Response.json({ 
          error: `Failed to fetch file: ${response.status} ${response.statusText}` 
        }, { status: 400 });
      }
      sourceInfo = 'Uploaded file';
      content = await response.text();
    } else {
      return Response.json({ error: 'Invalid input type. Must be "url", "text", or "file"' }, { status: 400 });
    }

    // Fetch GlobalConfig to get configured Actions and Constraints files
    let actionTerms = [];
    let constraintTerms = [];
    
    try {
      const configs = await base44.asServiceRole.entities.GlobalConfig.filter({});
      if (configs && configs.length > 0) {
        const config = configs[0];
        const subEntityFiles = config.kb_sub_entity_files || {};
        const dataBaseUrl = config.kb_search_data_url;
        
        // Fetch Actions file if configured
        if (subEntityFiles.actions && dataBaseUrl) {
          try {
            const actionsUrl = `${dataBaseUrl}/${subEntityFiles.actions}`;
            const actionsRes = await fetch(actionsUrl);
            if (actionsRes.ok) {
              const actionsData = await actionsRes.json();
              // Extract action labels - handle both array and object with actions key
              if (Array.isArray(actionsData)) {
                actionTerms = actionsData.map(a => a.label).filter(Boolean);
              } else if (actionsData.actions && Array.isArray(actionsData.actions)) {
                actionTerms = actionsData.actions.map(a => a.label).filter(Boolean);
              }
            }
          } catch (e) {
            console.log('Warning: Could not fetch actions file:', e.message);
          }
        }
        
        // Fetch Constraints file if configured
        if (subEntityFiles.constraints && dataBaseUrl) {
          try {
            const constraintsUrl = `${dataBaseUrl}/${subEntityFiles.constraints}`;
            const constraintsRes = await fetch(constraintsUrl);
            if (constraintsRes.ok) {
              const constraintsData = await constraintsRes.json();
              // Extract constraint labels - handle both array and object with constraints key
              if (Array.isArray(constraintsData)) {
                constraintTerms = constraintsData.map(c => c.label).filter(Boolean);
              } else if (constraintsData.constraints && Array.isArray(constraintsData.constraints)) {
                constraintTerms = constraintsData.constraints.map(c => c.label).filter(Boolean);
              }
            }
          } catch (e) {
            console.log('Warning: Could not fetch constraints file:', e.message);
          }
        }
      }
    } catch (e) {
      console.log('Warning: Could not fetch GlobalConfig:', e.message);
    }

    // Analyze content for OpenREL/ODRL rules, actions, and constraints
    const analysis = {
      source: sourceInfo,
      inputType: inputType,
      contentLength: content.length,
      hasRules: false,
      hasActions: false,
      hasConstraints: false,
      detectedPatterns: [],
      summary: '',
    };

    // Check for ODRL/OpenREL patterns
    const odrlTerms = ['odrl:', 'odrl:', 'Permission', 'Prohibition', 'Constraint', 'Action', 'Party', 'Asset'];
    const openrelTerms = ['openrel:', 'Policy', 'Rule', 'Action', 'Constraint'];
    
    // Add configured action and constraint terms to the search lists
    const allActionTerms = [...odrlTerms, ...openrelTerms, ...actionTerms];
    const allConstraintTerms = [...odrlTerms, ...openrelTerms, ...constraintTerms];
    
    const contentLower = content.toLowerCase();
    
    // Check for JSON-LD context with ODRL
    if (content.includes('"@context"') && (content.includes('odrl') || content.includes('ODRL'))) {
      analysis.hasRules = true;
      analysis.detectedPatterns.push('JSON-LD with ODRL context');
    }

    // Check for ODRL terms
    odrlTerms.forEach(term => {
      if (contentLower.includes(term.toLowerCase())) {
        analysis.hasRules = true;
        analysis.detectedPatterns.push(`ODRL term: ${term}`);
      }
    });

    // Check for OpenREL terms
    openrelTerms.forEach(term => {
      if (contentLower.includes(term.toLowerCase())) {
        analysis.hasRules = true;
        analysis.detectedPatterns.push(`OpenREL term: ${term}`);
      }
    });

    // Check for configured Action terms
    actionTerms.forEach(term => {
      if (contentLower.includes(term.toLowerCase())) {
        analysis.hasActions = true;
        analysis.detectedPatterns.push(`Configured Action: ${term}`);
      }
    });

    // Check for generic action patterns if no configured actions found
    if (!analysis.hasActions && (contentLower.includes('action') || contentLower.includes('permission') || contentLower.includes('prohibition'))) {
      analysis.hasActions = true;
      analysis.detectedPatterns.push('Action/Permission patterns detected');
    }

    // Check for configured Constraint terms
    constraintTerms.forEach(term => {
      if (contentLower.includes(term.toLowerCase())) {
        analysis.hasConstraints = true;
        analysis.detectedPatterns.push(`Configured Constraint: ${term}`);
      }
    });

    // Check for generic constraint patterns if no configured constraints found
    if (!analysis.hasConstraints && (contentLower.includes('constraint') || contentLower.includes('limit') || contentLower.includes('restriction'))) {
      analysis.hasConstraints = true;
      analysis.detectedPatterns.push('Constraint patterns detected');
    }

    // Generate summary
    if (analysis.hasRules) {
      analysis.summary = `Found ${analysis.detectedPatterns.length} OpenREL/ODRL pattern(s) in the object.`;
    } else {
      analysis.summary = 'No OpenREL/ODRL rules, actions, or constraints detected in the object.';
    }

    return Response.json({ analysis });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});