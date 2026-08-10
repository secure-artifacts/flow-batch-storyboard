# Contributing

1. Do not commit secrets, private checkpoints, generated media or internal information.
2. Keep Chromium and Firefox business logic synchronized.
3. Run `npm ci && npm test && npm run build` before opening a pull request.
4. Test output counts 1, 2, 3 and 4, including incremental task-ID callbacks.
5. Do not manually upload Release files. Releases are created only by the tag-triggered workflow.
6. Use semantic versioning and update both Manifest versions, `package.json`, tests and changelog together.

