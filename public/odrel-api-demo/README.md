# OpenREL KB API — standalone demo

A self-contained mock of the OpenREL KB API. No server, no database, no build
step: the endpoints are answered in the browser from the Turtle files in
`input/`, which are also preloaded in `data.js`.

## Run it

Unzip the bundle and open **`index.html`** — double-clicking works, in any
browser. Nothing to install.

Keep `index.html`, `data.js` and the `lib/` folder together; the page reads
`data.js` (the bundled Turtle sources) and `lib/` (the parser and router).
Serving the folder over HTTP also works, if you prefer:

```bash
python3 -m http.server 8080     # then open http://localhost:8080
npx serve .
```

Pick an endpoint on the left, adjust the URL or the `format` value, and press
**Send request**.

## What is inside

```
index.html                 the demo app
data.js                    generated: every bundled source file, inlined
manifest.json              generated: endpoints + which files back each section
input/…                    the same Turtle (and JSON) sources, at their
                           original repository paths — for reference and for
                           serving over HTTP
lib/rdf.js                 Turtle reader/writer (member parsing, TTL/JSON-LD output)
lib/mockApi.js             request routing and response shaping
```

Reads prefer `data.js`; if a file is not inlined, the page falls back to reading
it from `input/` over HTTP.

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
