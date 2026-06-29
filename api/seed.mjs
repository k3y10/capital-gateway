import { createHash } from "node:crypto";
import { getPool } from "./db.mjs";
import { documents, partners, projects } from "./seed-data.mjs";

function hashToken(token) {
  return token ? createHash("sha256").update(token).digest("hex") : null;
}

const pool = getPool();
const client = await pool.connect();

try {
  await client.query("BEGIN");

  for (const [slug, name, shortDescription, category, stage, fundingStatus, preferredPartnerType, dataroomAvailability, projectPool, priority] of projects) {
    await client.query(
      `INSERT INTO projects (slug, name, short_description, category, stage, funding_status, preferred_partner_type, dataroom_availability, pool, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         short_description = EXCLUDED.short_description,
         category = EXCLUDED.category,
         stage = EXCLUDED.stage,
         funding_status = EXCLUDED.funding_status,
         preferred_partner_type = EXCLUDED.preferred_partner_type,
         dataroom_availability = EXCLUDED.dataroom_availability,
         pool = EXCLUDED.pool,
         priority = EXCLUDED.priority,
         updated_at = now()`,
      [slug, name, shortDescription, category, stage, fundingStatus, preferredPartnerType, dataroomAvailability, projectPool, priority],
    );
  }

  for (const [name, organization, email, code, role, accessLevel, joinedAt] of partners) {
    const token = process.env[`PARTNER_TOKEN_${code.replaceAll("-", "_")}`] ?? null;
    const partner = await client.query(
      `INSERT INTO partners (name, organization, email, code, role, access_level, joined_at, portal_token_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         organization = EXCLUDED.organization,
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         access_level = EXCLUDED.access_level,
         portal_token_hash = COALESCE(EXCLUDED.portal_token_hash, partners.portal_token_hash),
         updated_at = now()
       RETURNING id`,
      [name, organization, email, code, role, accessLevel, joinedAt, hashToken(token)],
    );

    await client.query(
      `INSERT INTO referral_links (partner_id, code, url)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET partner_id = EXCLUDED.partner_id, url = EXCLUDED.url`,
      [partner.rows[0].id, code, `/invite/${code}`],
    );
  }

  for (const [projectSlug, title, category, uploadDate, version, visibility, status] of documents) {
    await client.query(
      `INSERT INTO dataroom_documents (project_slug, title, category, upload_date, version, visibility, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING`,
      [projectSlug, title, category, uploadDate, version, visibility, status],
    );
  }

  await client.query("COMMIT");
  console.log("Capital Gateway seed data is in Postgres.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
