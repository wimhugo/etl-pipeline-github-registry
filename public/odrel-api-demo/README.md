# OpenREL KB API — standalone demo

A self-contained mock of the OpenREL KB API. No server, no database, no build
step: the endpoints are answered in the browser from the Turtle files in
`input/`.

## Run it

Browsers refuse to read local files when a page is opened straight from disk
(`file://`). Serve the folder instead — pick whichever line works on your
machine, from inside this folder:

```bash
python3 -m http.server 8080     # then open http://localhost:8080
npx serve .                     # or: npx http-server .
```

`index.html` opens with a list of endpoints on the left. Pick one, adjust the
URL or the `format` value, and press **Send request**.

## What is inside

```
index.html                 the demo app
manifest.json              generated: endpoints + which files back each section
input/…                    the Turtle (and JSON) source files, at their
                           original repository paths
lib/rdf.js                 Turtle reader/writer (member parsing, TTL/JSON-LD output)
lib/mockApi.js             request routing and response shaping
```

## Same behaviour as the hosted API

The mock follows the hosted `fetchApiSourceContent` behaviour:

- `format=ttl` (default), `format=json`, `format=json-ld`
- list endpoints return `iri`, `label`, `definition`
- detail endpoints (`/{id}`) return the full property set
- `id` and `prefix` filters
- folder-backed sections (e.g. Policies) read each file as one member
- the Mappings section is composed from every other source at request time

Endpoints wired to other handlers (for example policy indexing) answer
`501` — they are not part of the offline bundle.

## Refresh the data

Re-export the bundle from the app (KB API → Preview → *Download standalone
bundle*) to pick up the latest source files.
