# Protected portfolio API releases

This procedure is separate from the static Site workflow. This change creates the
manual workflow and tests, **not credentials, environment protection rules, an API
deployment, DNS changes or MCP activation**. Existing static asset configuration,
Site deployment provenance, branch restrictions, email and DNS remain intact.

## Owner setup (private; no secrets in Git)

1. Create the GitHub environment `portfolio-api-production`. Restrict deployment
   branches to `main` only and require owner approval before secrets are released.
   Review the protection policy before enabling the release gate. Do not let the
   workflow implicitly create an unprotected environment.
2. Create a separate Cloudflare deployment token for the intended account with
   Workers Scripts Edit (and the read access needed for versions/deployments).
   Do not grant DNS, email, zone routing or account-plan permissions. Cloudflare's
   token permission may cover Worker scripts throughout the account; it is not a
   promise of per-script scope. Keep the existing static-site token unchanged.
   Store it as environment secret `PORTFOLIO_API_TOKEN`, and the account ID as
   environment secret `CLOUDFLARE_ACCOUNT_ID`. Never paste them into issues or logs.
3. Inspect the live API bindings and settings privately. Preserve Workers AI `AI`,
   request limiter namespace `10001` (5/minute), inference limiter `10002`
   (20/minute), custom domain `portfolio-api.jorgeaviles.net`, disabled workers.dev
   and preview URLs, disabled observability and `ASSISTANT_ENABLED=true`. The MCP
   version adds `MCP_LIMITER`, namespace `10003` (60/minute); confirm no existing
   binding uses that namespace differently. No DNS changes are needed. If domain
   work becomes necessary, take an ignored private DNS snapshot and compare
   protected email records afterward as required by AGENTS.md.
4. Set repository variable `ENABLE_PORTFOLIO_API_RELEASE=true` only after the
   environment protection and secrets are ready. Leave environment variable
   `PORTFOLIO_MCP_CLIENT_VERIFIED` absent/false until the hosted client and Free CPU
   checks in [the MCP document](portfolio-mcp-plan.md) pass. Setting it true is a
   separate owner activation decision, not a consequence of merging this PR.

## Release

After owner review and merge, dispatch **Portfolio API release** on `main` with
`action=deploy`, `mcp_enabled=false`, `expected_current_mcp=false`. The assistant
flag is always preserved as true in this release path; the local disabled default
cannot accidentally turn it off. An unexpected existing assistant flag or MCP
flag fails the release instead of silently overriding production.

The workflow runs full repository verification, builds one API module, enforces
the Free compressed size bound, and boots that exact artifact locally. The
protected release job downloads the specific artifact ID with digest validation,
checks its commit and SHA-256 file hashes, verifies fresh main, and inspects the
live active version. It uploads a new version with explicit approved flags, checks
its stored flags, then rechecks main and the active version before promoting it to
100%. Releases share a non-cancelling concurrency group. Branch dispatches are
skipped; push and PR events cannot trigger the API workflow.

Version upload and promotion intentionally use the version APIs, leaving existing
routes/domains and non-versioned settings in place. See Cloudflare's
[versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/).
No static-site assets are uploaded. No persistent storage migrations exist.
GitHub's release summary records source commit, new version, previous version and
both flags. Keep that summary for rollback. Upload errors and ambiguous promotion
failures stop without automatic retries; inspect active state before dispatching
again. A successfully uploaded but unpromoted version does not receive traffic.

The post-release smoke test checks route isolation and optional MCP discovery
without requesting AI inference. Separately perform one deliberate public `/ask/`
question to confirm the complete visitor flow; preflight alone does not prove AI
answers. Platform propagation or a failed smoke test requires investigation;
the workflow does not roll back automatically.

## Rollback

Dispatch the same workflow on current `main` with `action=rollback` and an exact
previous version UUID from the release summary. Set `expected_current_mcp` to the
observed live value and `mcp_enabled` to the selected version's recorded value.
The workflow requires a single active 100% version, verifies that the candidate
appears in recent deployment history, and checks its stored flags before promotion.
It refuses any rollback that would disable the assistant or unexpectedly activate
MCP. A pre-MCP version with no MCP variable is treated as MCP=false. The rollback
uses the same environment approval, source freshness and concurrency gates.

Cloudflare rollback restores the selected version's code and bindings; it does
not reverse unrelated non-versioned account settings. See
[Cloudflare rollback behavior](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).
If a desired version has fallen out of recent deployment history, review it
privately and prepare a controlled recovery; do not bypass checks or guess an ID.
An emergency assistant shutdown is a separate owner-directed operation, not this
preserve-assistant release path.

## Evidence and credentials

Save operational snapshots/transcripts in ignored `.private/` or `.local/` only.
Never commit tokens, exports, local credentials, account IDs, visitor requests or
internal screenshots. This PR's local tests do not validate future GitHub token
permissions, owner environment setup, hosted CPU, or a production release. Those
checks remain explicit operational follow-up after review.
