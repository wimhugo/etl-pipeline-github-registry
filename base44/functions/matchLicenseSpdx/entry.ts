import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { licenseUri, licenseName } = await req.json();
        
        if (!licenseUri && !licenseName) {
            return Response.json({ error: 'Either licenseUri or licenseName is required' }, { status: 400 });
        }

        // Fetch all licenses from LFS
        const lfsResponse = await fetch('https://lfs.labs.dansdemo.nl/api/v1/licenses', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!lfsResponse.ok) {
            const errorText = await lfsResponse.text();
            return Response.json({ 
                error: 'Failed to fetch licenses from LFS', 
                details: errorText || lfsResponse.statusText 
            }, { status: lfsResponse.status });
        }

        const lfsData = await lfsResponse.json();
        const licenses = lfsData.licenses || [];

        // Try to match the license
        let matchedLicense = null;
        let matchReason = '';

        if (licenseUri) {
            // Try exact URI match
            matchedLicense = licenses.find(lic => 
                lic.uri === licenseUri || 
                lic.reference === licenseUri ||
                lic.seeAlso?.includes(licenseUri)
            );
            if (matchedLicense) {
                matchReason = 'URI match';
            }
        }

        if (!matchedLicense && licenseName) {
            // Try fuzzy name matching
            const normalizedName = licenseName.toLowerCase().trim();
            matchedLicense = licenses.find(lic => 
                lic.name.toLowerCase() === normalizedName ||
                lic.licenseId.toLowerCase() === normalizedName
            );
            if (matchedLicense) {
                matchReason = 'Name match';
            }

            // If still no match, try partial matching
            if (!matchedLicense) {
                matchedLicense = licenses.find(lic => 
                    lic.name.toLowerCase().includes(normalizedName) ||
                    normalizedName.includes(lic.name.toLowerCase())
                );
                if (matchedLicense) {
                    matchReason = 'Partial name match';
                }
            }
        }

        if (!matchedLicense) {
            return Response.json({ 
                found: false,
                message: 'No matching license found in LFS',
                searchedUri: licenseUri,
                searchedName: licenseName
            });
        }

        // Return matched license with SPDX information
        return Response.json({
            found: true,
            matchReason,
            license: {
                licenseId: matchedLicense.licenseId,
                name: matchedLicense.name,
                spdxUri: matchedLicense.reference,
                detailsUrl: matchedLicense.detailsUrl,
                lfsUri: matchedLicense.uri,
                isOsiApproved: matchedLicense.isOsiApproved,
                isDeprecatedLicenseId: matchedLicense.isDeprecatedLicenseId,
                seeAlso: matchedLicense.seeAlso,
                licenseText: matchedLicense.licenseText
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});