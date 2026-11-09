# Runtime support agent (demo)

Drop in a support ticket. Get the reply drafted, or escalated with the context attached.

A one-page demo of an internal support-triage agent: it reads a ticket, drafts the reply from help docs, and either sends it or asks a person to approve, with the trace attached. Bugs are filed to engineering and feature requests logged for product.

- `data.js`: demo tickets, demo help articles, pre-run agent outputs and routing evals (all illustrative)
- `engine.js`: the routing rules and a rules-only classifier (pure functions, no network)
- `app.js`: the page; optional bring-your-own-key live draft via the Anthropic API from the browser

Static, no backend. Built by Jake Makking-Robinson. Not affiliated with Runtime.
