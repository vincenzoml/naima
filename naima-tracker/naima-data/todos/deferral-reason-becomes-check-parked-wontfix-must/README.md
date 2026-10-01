# Deferral-with-reason becomes a check (`parked`/`wontfix` must say why)

`parked` and `wontfix` can currently be silent.

Done: both are checked like `partial` already is — a problem when the page gives no reason; reporting-and-triage gains the 'capture now, act later' and 'I already told you' steps. Extends naturally into the related item's `reopensWhen` field.
