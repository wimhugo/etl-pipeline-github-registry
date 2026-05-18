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

    const contentLower = content.toLowerCase();
    
    // STEP 1: Detect patterns in content WITHOUT any reference to OpenREL files
    const detectedActions = [];
    const detectedConstraints = [];
    
    const actionKeywords = ['reproduce', 'copy', 'distribute', 'share', 'display', 'perform', 'modify', 'adapt', 'translate', 'extract', 'reuse', 'sell', 'rent', 'lend', 'broadcast', 'communicate', 'make available', 'print', 'download', 'stream', 'archive', 'preserve', 'synchronize', 'digitize'];
    const constraintKeywords = ['expires', 'expire', 'duration', 'scope', 'territory', 'language', 'medium', 'purpose', 'educational', 'commercial', 'non-commercial', 'attribution', 'credit', 'notice', 'limit', 'restriction', 'max', 'min', 'until', 'from', 'after'];
    
    actionKeywords.forEach(keyword => {
      if (contentLower.includes(keyword.toLowerCase())) {
        detectedActions.push(keyword);
      }
    });
    
    constraintKeywords.forEach(keyword => {
      if (contentLower.includes(keyword.toLowerCase())) {
        detectedConstraints.push(keyword);
      }
    });
    
    // STEP 2: Load OpenREL Actions and Constraints files, try to auto-match
    let openrelActions = [];
    let openrelConstraints = [];
    
    try {
      const configs = await base44.asServiceRole.entities.GlobalConfig.filter({});
      if (configs && configs.length > 0) {
        const config = configs[0];
        const subEntityFiles = config.kb_sub_entity_files || {};
        const dataBaseUrl = config.kb_search_data_url;
        
        if (subEntityFiles.actions && dataBaseUrl) {
          const actionsUrl = `${dataBaseUrl}/${subEntityFiles.actions}`;
          const actionsRes = await fetch(actionsUrl);
          if (actionsRes.ok) {
            const actionsData = await actionsRes.json();
            openrelActions = Array.isArray(actionsData) ? actionsData : (actionsData.actions || []);
          }
        }
        
        if (subEntityFiles.constraints && dataBaseUrl) {
          const constraintsUrl = `${dataBaseUrl}/${subEntityFiles.constraints}`;
          const constraintsRes = await fetch(constraintsUrl);
          if (constraintsRes.ok) {
            const constraintsData = await constraintsRes.json();
            openrelConstraints = Array.isArray(constraintsData) ? constraintsData : (constraintsData.constraints || []);
          }
        }
      }
    } catch (e) {
      console.log('Could not load OpenREL files:', e.message);
    }
    
    // Fuzzy matching helper - returns similarity score (0-1)
    const similarity = (s1, s2) => {
      const str1 = s1.toLowerCase().trim();
      const str2 = s2.toLowerCase().trim();
      if (str1 === str2) return 1.0;
      if (str1.includes(str2) || str2.includes(str1)) return 0.8;
      
      // Levenshtein distance-based similarity
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;
      if (longer.length === 0) return 1.0;
      
      const costs = new Array(shorter.length + 1);
      for (let i = 0; i <= shorter.length; i++) costs[i] = i;
      
      for (let i = 1; i <= longer.length; i++) {
        let prev = costs[0];
        costs[0] = i;
        for (let j = 1; j <= shorter.length; j++) {
          const curr = costs[j];
          const cost = longer[i-1] === shorter[j-1] ? 0 : 1;
          costs[j] = Math.min(Math.min(costs[j-1] + 1, costs[j] + 1), prev + cost);
          prev = curr;
        }
      }
      
      const distance = costs[shorter.length];
      return 1 - (distance / longer.length);
    };
    
    // Auto-match detected items with OpenREL items using fuzzy matching
    const MATCH_THRESHOLD = 0.75;
    
    const matchedActions = detectedActions.map(detected => {
      let bestMatch = null;
      let bestScore = 0;
      
      for (const openrel of openrelActions) {
        const label = (openrel.label || '').toLowerCase();
        const score = similarity(detected.toLowerCase(), label);
        if (score > bestScore && score >= MATCH_THRESHOLD) {
          bestScore = score;
          bestMatch = openrel;
        }
      }
      
      return { 
        detected, 
        matchedLabel: bestMatch?.label || '', 
        matchedId: bestMatch?.id || '',
        matchScore: bestScore
      };
    });
    
    const matchedConstraints = detectedConstraints.map(detected => {
      let bestMatch = null;
      let bestScore = 0;
      
      for (const openrel of openrelConstraints) {
        const label = (openrel.label || '').toLowerCase();
        const score = similarity(detected.toLowerCase(), label);
        if (score > bestScore && score >= MATCH_THRESHOLD) {
          bestScore = score;
          bestMatch = openrel;
        }
      }
      
      return { 
        detected, 
        matchedLabel: bestMatch?.label || '', 
        matchedId: bestMatch?.id || '',
        matchScore: bestScore
      };
    });

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
    
    // Check for JSON-LD context with ODRL
    if (content.includes('"@context"') && (content.includes('odrl') || content.includes('ODRL'))) {
      analysis.hasRules = true;
      analysis.detectedPatterns.push('JSON-LD with ODRL context');
    }

    // Check for ODRL/OpenREL structural patterns
    const odrlTerms = ['odrl:', 'Permission', 'Prohibition', 'Constraint', 'Action', 'Party', 'Asset'];
    const openrelTerms = ['openrel:', 'Policy', 'Rule', 'Action', 'Constraint'];
    
    odrlTerms.forEach(term => {
      if (contentLower.includes(term.toLowerCase())) {
        analysis.hasRules = true;
        analysis.detectedPatterns.push(`ODRL term: ${term}`);
      }
    });

    openrelTerms.forEach(term => {
      if (contentLower.includes(term.toLowerCase())) {
        analysis.hasRules = true;
        analysis.detectedPatterns.push(`OpenREL term: ${term}`);
      }
    });

    // STEP 3: Return results with matched actions and constraints
    analysis.hasActions = matchedActions.length > 0;
    analysis.hasConstraints = matchedConstraints.length > 0;
    
    matchedActions.forEach(item => {
      if (item.matchedLabel) {
        analysis.detectedPatterns.push(`Configured Action: ${item.detected}|${item.matchedId}|${item.matchedLabel}`);
      } else {
        analysis.detectedPatterns.push(`Potential Action: ${item.detected}||`);
      }
    });
    
    matchedConstraints.forEach(item => {
      if (item.matchedLabel) {
        analysis.detectedPatterns.push(`Configured Constraint: ${item.detected}|${item.matchedId}|${item.matchedLabel}`);
      } else {
        analysis.detectedPatterns.push(`Potential Constraint: ${item.detected}||`);
      }
    });

    // Fallback: generic action pattern mention
    if (!analysis.hasActions && (contentLower.includes('action') || contentLower.includes('permission') || contentLower.includes('prohibition'))) {
      analysis.hasActions = true;
      analysis.detectedPatterns.push('Generic action language detected');
    }

    // Check for ODRL/OpenREL generic patterns (fallback)
    if (!analysis.hasActions && (contentLower.includes('action') || contentLower.includes('permission') || contentLower.includes('prohibition'))) {
      analysis.hasActions = true;
      analysis.detectedPatterns.push('Generic action language detected');
    }
    
    if (!analysis.hasConstraints && (contentLower.includes('constraint') || contentLower.includes('limit') || contentLower.includes('restriction'))) {
      analysis.hasConstraints = true;
      analysis.detectedPatterns.push('Generic constraint language detected');
    }

    // Fallback: generic constraint pattern mention
    if (!analysis.hasConstraints && (contentLower.includes('constraint') || contentLower.includes('limit') || contentLower.includes('restriction'))) {
      analysis.hasConstraints = true;
      analysis.detectedPatterns.push('Generic constraint language detected');
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