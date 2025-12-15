## Agent Mesh

Multi-player “session code” app where profiles are matched by embeddings + an LLM drafts consent-first intros.

### Setup

- Copy env template:
  - `cp env.example .env`
- Fill `NEXTAUTH_SECRET`, Google OAuth creds, and `OPENAI_API_KEY`.
- Optional: fill SMTP vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) to receive match emails.
- Install + migrate:
  - `npm install`
  - `npm run prisma:migrate`
- Run:
  - `npm run dev`


