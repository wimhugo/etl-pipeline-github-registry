/**
 * Provenance utilities
 *
 * Stamps local and persisted records with the creator's ORCID iD so that
 * every artefact can be attributed to the researcher who produced it.
 *
 * Convention:
 *   created_by_orcid  – ORCID of the person who first created the record
 *   updated_by_orcid  – ORCID of the person who last saved/updated the record
 *
 * Retroactive default:
 *   Records created before this feature existed are attributed to the known
 *   single identity that produced all historical data.
 */

export const RETROACTIVE_ORCID = '0000-0002-0255-5101';

/**
 * Fetch the current user's ORCID from their profile.
 * Falls back to the retroactive ORCID if none is set.
 */
export async function getCurrentOrcid(base44) {
  try {
    const me = await base44.auth.me();
    return me?.orcid?.trim() || RETROACTIVE_ORCID;
  } catch {
    return RETROACTIVE_ORCID;
  }
}

/**
 * Stamp a single record with provenance fields.
 * - created_by_orcid is only set if not already present (preserves original author)
 * - updated_by_orcid is always set to the current user
 */
export function stampProvenance(record, orcid) {
  return {
    ...record,
    created_by_orcid: record.created_by_orcid || orcid,
    updated_by_orcid: orcid,
  };
}

/**
 * Retroactively backfill created_by_orcid on an array of records
 * that are missing the field, using the retroactive ORCID as the author.
 * Only patches; does not overwrite existing values.
 */
export function backfillProvenance(records, orcid = RETROACTIVE_ORCID) {
  return records.map(r =>
    r.created_by_orcid
      ? r
      : { ...r, created_by_orcid: orcid }
  );
}

/**
 * Read, backfill, and re-persist the localStorage draft policies.
 * Returns the backfilled array so callers can use it directly.
 */
export function backfillLocalDrafts(orcid = RETROACTIVE_ORCID) {
  try {
    const raw = localStorage.getItem('kbcompose_drafts');
    if (!raw) return [];
    const drafts = JSON.parse(raw);
    const patched = backfillProvenance(drafts, orcid);
    // Only persist if something actually changed
    if (patched.some((p, i) => p.created_by_orcid !== drafts[i]?.created_by_orcid)) {
      localStorage.setItem('kbcompose_drafts', JSON.stringify(patched));
    }
    return patched;
  } catch {
    return [];
  }
}