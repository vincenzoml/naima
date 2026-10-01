# Document the repository completely, reference generated from the plugin manifests

Anyone opening the repository must be able to find every feature: every
command with its options and an example, every item type and status, every
field, every link relation, every check, every gate and how it decides, every
plugin and its options, the config file, the verifier contract, the bootstrap
policy, the flows.

- [x] README stays short and links a docs index (`docs/README.md`)
- [x] the reference is generated from the manifests (`naima docs`) and
  checked: `npm run verify` fails when `docs/reference.md` is out of date or
  anything loaded is undocumented; a test fails when the config stops loading
  a first-party plugin
- [x] hand-written pages for what no manifest holds: concepts, config,
  plugin contract (with the verifier contract), architecture, the
  documentation rule, bootstrap, flows

## Evidence

`attachments/reference-check-2026-09-29.txt`. Proof owed:
`tests/reference-current-every-loaded-contribution-documented`.
