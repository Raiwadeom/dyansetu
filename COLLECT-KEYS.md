# Collecting your keys with Claude in Chrome

Claude in Chrome is a **different Claude** from the one in your terminal. It runs
inside your browser and can read pages you are logged into; the terminal one can
read your files and run your code. Neither can talk to the other, so you are the
link between them — but the handover below is a copy and a paste, nothing more.

## 1. Approve the two sites

Claude in Chrome starts with no site permissions ("No sites have been approved
yet"). Open each console, click the Claude icon, and allow it on:

- `console.firebase.google.com`
- `console.cloudinary.com`

## 2. Give it this prompt

Open your Firebase project in a tab, click the Claude extension, and paste:

---

Read the values I need to configure a web app, from two consoles I am logged
into. Do not change any setting — only read.

**In the Firebase console**, for my DnyanSetu project, go to
Project Settings → General → Your apps → the Web app, and read the
`firebaseConfig` block.

**In the Cloudinary console**, read the Cloud name from the dashboard header,
then go to Settings → API Keys and read the API Key and API Secret.

Then output exactly this, filled in, and nothing else:

```
apiKey: "..."
authDomain: "..."
projectId: "..."
storageBucket: "..."
messagingSenderId: "..."
appId: "..."
CLOUD_NAME: ...
API_KEY: ...
API_SECRET: ...
```

---

## 3. Bring it back

Run `npm run setup` in the terminal, paste the block, press Enter on a blank
line, then answer the three Cloudinary questions. The script sorts out which
value goes where and checks all of them against the live APIs before writing
`.env.local`.

## Two things no Claude can do for you

Both are clicks in a dashboard, and both matter:

1. **Firestore → Rules** — paste all of `firestore.rules`, press Publish.
   Without this your database is open.
2. **Cloudinary → Settings → Upload** — create an upload preset named
   `dnyansetu_signed` with signing mode **Signed**.

## A note on the secret

The Cloudinary API Secret is the one value in this project that must stay
private. It goes in `.env.local`, which is already in `.gitignore`, and it is
never sent to a browser. Do not paste it into a public chat, a screenshot, or a
commit. If it does leak, rotate it in Settings → API Keys and re-run setup.
