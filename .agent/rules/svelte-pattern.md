---
trigger: always_on
---

# Manejo de Errorres con remote functions

- El server con las remote functions puede realizar las validaciones con valibot, pero es necesario hacer client-side validations para poder mostrar correctamente los errores al usuario.
- Usa toast si es posible. En el caso de que use modal, entonces puedes usar el toast y un pequeño recuadro en el modal (ya que el toast tiende a quedarse de fondo)

# Component Self-Containment Rule:

If a component performs a specific action (like toggle, delete, reactivate), it should import and call the remote function internally. Pass only the data needed and emit events (like onSuccess, onError) for parent coordination. Generic components (like ConfirmModal) take callbacks; domain-specific components call their own remotes.

# Remote Function Usage Pattern
| Function | Use Case |
|----------|----------|
| **`query`** | Read data (GET operations) |
| **`query.batch`** | Multiple queries, avoid N+1 |
| **`form`** | Form submissions with validation |
| **`command`** | Button clicks, non-form actions |