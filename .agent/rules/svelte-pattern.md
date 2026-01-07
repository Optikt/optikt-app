---
trigger: always_on
---

# Manejo de Errorres con remote functions

- El server con las remote functions puede realizar las validaciones con valibot, pero es necesario hacer client-side validations para poder mostrar correctamente los errores al usuario.
- Usa toast si es posible. En el caso de que use modal, entonces puedes usar el toast y un pequeño recuadro en el modal (ya que el toast tiende a quedarse de fondo)
