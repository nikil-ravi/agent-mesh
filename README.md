## Agent Mesh

AI based system for scaling communication between people. The idea is that earlier, each person needed to interact with each other person. Now, with AI, we can scale communication; each person enters their info and interests, and the AI agent sort of talks to other AI agents on their behalf, and escalates things to them in a if there are interesting opportunities or if there is some input needed from the human before the AI continues the conversation. 

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


