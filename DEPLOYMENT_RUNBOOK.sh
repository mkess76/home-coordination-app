# ============================================================
# Home Coordination App — Deployment Runbook
# Target: home.rancherlab.org
# ============================================================
# Run all vault commands from a machine with VAULT_ADDR and
# VAULT_TOKEN set, or exec into the Vault pod:
#   kubectl exec -it -n security vault-0 -- sh

# ============================================================
# STEP 1 — Store secrets in Vault
# ============================================================

# Google OAuth Client ID (this value is also baked into the React
# bundle at image build time as REACT_APP_GOOGLE_CLIENT_ID, so it
# is not truly secret — but store it here for consistency)
vault kv put secret/prod/homeautomation/google-client-id \
  value="<your_google_oauth_client_id>"

# Google OAuth Client Secret (genuinely secret — never in Git)
vault kv put secret/prod/homeautomation/google-client-secret \
  value="<your_google_client_secret>"

# If the weather feature requires an API key (check server/routes/weather.js
# for the actual env var name used in the code):
# vault kv put secret/prod/homeautomation/weather-api-key \
#   value="<your_weather_api_key>"

# ============================================================
# STEP 2 — Create Vault policy for home-coordination
# ============================================================

vault policy write home-coordination - <<EOF
path "secret/data/prod/homeautomation/*" {
  capabilities = ["read"]
}
EOF

# ============================================================
# STEP 3 — Create Vault Kubernetes auth role
# ============================================================
# This binds the home-coordination ServiceAccount in the
# home-coordination namespace to the policy created above.

vault write auth/kubernetes/role/home-coordination \
  bound_service_account_names=home-coordination \
  bound_service_account_namespaces=home-coordination \
  policies=home-coordination \
  ttl=1h

# ============================================================
# STEP 4 — Google Cloud OAuth configuration
# ============================================================
# In Google Cloud Console → APIs & Services → Credentials:
# Edit your OAuth 2.0 Client ID and add:
#
# Authorized JavaScript origins:
#   https://home.rancherlab.org
#
# Authorized redirect URIs:
#   https://home.rancherlab.org/api/google/oauth/callback
#
# Remove localhost entries if this was previously dev-only.

# ============================================================
# STEP 5 — Cloudflare Tunnel configuration
# ============================================================
# Add the following ingress rule to your existing rancherlab.org tunnel
# config (via Cloudflare Zero Trust dashboard or cloudflared config YAML).
# This goes BEFORE the catch-all rule.
#
# Tunnel 1 (rancherlab.org) — add new ingress entry:
#
#   hostname: home.rancherlab.org
#   service: http://10.0.60.x:80   # NGINX ingress controller MetalLB IP on VLAN 60
#
# Cloudflare Access policy (same as existing rancherlab.org apps):
#   Application: home.rancherlab.org
#   Policy: GitHub SSO — allow your GitHub org/user
#
# The tunnel already handles TLS at the edge. No cert-manager
# annotation is needed on the Ingress manifest.

# ============================================================
# STEP 6 — Commit manifests to GitOps repo
# ============================================================

# In your rancher-gitops repository:
#
#   rancher-gitops/
#     apps/
#       home-coordination/          ← contents of apps/ directory
#         kustomization.yaml
#         namespace.yaml
#         serviceaccount.yaml
#         pvc.yaml
#         externalsecret.yaml
#         deployment.yaml
#         service.yaml
#         ingress.yaml
#         networkpolicy.yaml
#     flux-system/
#       apps/
#         home-coordination.yaml    ← Flux Kustomization CRD

# git checkout -b infra/home-coordination/initial-deploy
# git add apps/home-coordination/ flux-system/apps/home-coordination.yaml
# git commit -m "feat(home-coordination): initial deployment manifests"
# git push && open PR for review

# ============================================================
# STEP 7 — Verify deployment (gate criteria)
# ============================================================

# 7a. Flux reconciliation
kubectl get kustomization -n flux-system home-coordination
# Expected: READY=True, no errors

# 7b. ExternalSecret synced
kubectl get externalsecret -n home-coordination home-coordination-secrets
# Expected: READY=True, STATUS=SecretSynced

# 7c. PVC bound
kubectl get pvc -n home-coordination home-coordination-data
# Expected: STATUS=Bound, STORAGECLASS=longhorn

# 7d. Pod running
kubectl get pods -n home-coordination
# Expected: home-coordination-xxxxxxx-xxxxx  1/1  Running

# 7e. Readiness check (from inside the cluster)
kubectl run -it --rm debug --image=curlimages/curl --restart=Never \
  -- curl -s -o /dev/null -w "%{http_code}" \
  http://home-coordination.home-coordination.svc.cluster.local/
# Expected: 200

# 7f. External access
# Visit https://home.rancherlab.org in a browser
# Expected: Cloudflare Access GitHub SSO prompt → app loads

# ============================================================
# KNOWN ISSUES & FOLLOW-UP ITEMS
# ============================================================

# 1. SQLITE SCALE LIMIT
#    Replicas are capped at 1 due to SQLite file locking. If you need
#    HA or want to run more than one replica, migrate the backend to use
#    PostgreSQL at postgresql.data.svc.cluster.local:5432.
#    The server likely already has the DB connection abstracted —
#    check server/db.js or server/database.js for the connection setup.

# 2. NO HEALTH ENDPOINT
#    The README documents no /health route. The liveness probe currently
#    uses tcpSocket which only confirms the port is open. Add this to
#    server/server.js for a proper liveness check:
#
#      app.get('/health', (req, res) => res.json({ status: 'ok' }));
#
#    Then update the livenessProbe in deployment.yaml to httpGet /health.

# 3. REACT_APP_GOOGLE_CLIENT_ID IS BUILD-TIME
#    The React bundle has REACT_APP_GOOGLE_CLIENT_ID baked in at docker build
#    time. The value in the running container cannot be changed without a
#    rebuild. This is expected React behavior (REACT_APP_ vars are embedded
#    in the bundle). If you ever rotate the OAuth client, you will need to
#    rebuild and redeploy the image. Consider adding it as a Docker build
#    ARG in the Dockerfile to make CI aware of it.

# 4. WEATHER FEATURE API KEY
#    The README mentions a Weather feature but lists no API key in the env
#    vars. Check server/routes/weather.js to confirm whether an API key
#    is required and what env var name it expects. Add it to Vault and the
#    ExternalSecret if needed (commented placeholder is already in
#    externalsecret.yaml).

# 5. DB_PATH ENV VAR
#    The deployment sets DB_PATH=/app/server/data/database.db assuming the
#    server reads this env var for the SQLite file location. Verify this
#    against server/db.js or wherever the SQLite connection is initialized.
#    If the server hardcodes the path, you may need a small code change to
#    read process.env.DB_PATH.

# 6. HOSTNAME DISCREPANCY
#    The prompt referenced homeautomation.rancherlab.org but the README
#    specifies home.rancherlab.org as the production target. Manifests use
#    home.rancherlab.org. Update ingress.yaml and env vars if you want a
#    different subdomain.
