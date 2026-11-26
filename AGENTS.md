# Coollife account and data boundaries

- This is the user's personal Coollife business project. Never use company accounts, company OAuth/API tokens, organization repositories, or company cloud resources.
- Cloudflare login must be `kmj843337@gmail.com` and account ID must be `06bada574d14a5e1d912f35b4645f695` before any resource mutation or deployment. If credentials are unknown or different, stop deployment and request personal login. Do not fall back to another account.
- GitHub operations, if requested, use personal `minjaedy` credentials scoped to the command. Do not use or change the global/company GitHub identity.
- Keep all Coollife databases, secrets, uploads and apps separate from DYDY, MIXROOM, TEMPO and work projects.
- Local preview uses fictional records only. Never copy existing app customer/user data into this project.
- No SMS, email, phone calls, purchases or paid service activation without explicit authorization. Customer updates are displayed inside their quote page.
- Customer access must be checked on the server for every quote, timeline and photo. Never expose a public customer list or sequential identifiers as authorization.
- Never commit secrets or runtime database files. Never ship preview-admin bypasses as production authentication.
