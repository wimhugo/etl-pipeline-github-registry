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

    // Check for specific action patterns
    if (contentLower.includes('action') || contentLower.includes('permission') || contentLower.includes('prohibition')) {
      analysis.hasActions = true;
      analysis.detectedPatterns.push('Action/Permission patterns detected');
    }

    // Check for constraint patterns
    if (contentLower.includes('constraint') || contentLower.includes('limit') || contentLower.includes('restriction')) {
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