# Spec: rework-editar-venta-ui-ux

Scope: feature

# Editor de documentos comerciales — ventas y presupuestos

## Objetivo

Rehacer la edición de ventas con un flujo claro para reemplazar cristales, editar recetas y revisar cambios. La solución debe dejar un contrato reutilizable para editar presupuestos sin duplicar la UI.

## Decisiones aprobadas

- Arquitectura: shell visual compartido + adaptadores por dominio.
- Primer entregable: ventas funcionales; contrato y componentes compartidos listos para quotes, sin construir aún la pantalla completa de edición de quote.
- Editor de cristal dedicado, separado del resumen principal. El usuario aplica el cristal al borrador y luego guarda el documento completo.
- Rango óptico del cristal: advertencia confirmable por ojo, nunca blocker.
- Límites físicos y estructura de receta: errores bloqueantes.

## Contrato común

El shell recibe un draft de documento con encabezado, cliente, notas, descuentos, ítems polimórficos, resumen y estado dirty. Los ítems compartidos son producto, cristal, tratamiento e ítem libre. La relación de tratamientos se adapta mediante parentSaleItemId para ventas y parentQuoteItemId para quotes.

El adaptador de ventas expone fecha de venta, motivo obligatorio, actualización remota, inventario, protección de monto pagado y auditoría. El futuro adaptador de quotes expone fecha de validez y actualización de quote; no consume inventario ni valida pagos.

## Validación

### Bloquea

- Cristal/producto requerido cuando corresponda.
- Precio, cantidad, descuento o datos libres inválidos.
- Receta incompleta, cilindro positivo bajo la convención actual, eje/altura/DP inválidos.
- Tratamiento sin padre, proveedor incompatible o relación inválida.
- Stock insuficiente.
- Venta con total menor al monto ya cobrado.
- Documento en estado no editable o usuario no autorizado.

### Advierte y permite confirmar

- Esfera, cilindro o adición fuera del rango óptico del cristal seleccionado.
- La advertencia muestra ojo, valor y rango disponible; las acciones son volver a editar o confirmar.

## UI propuesta

1. Drawer principal: encabezado del documento, cambios generales, lista de artículos, resumen de diferencias y footer sticky.
2. Editor de cristal dedicado: catálogo/precio, receta OD/OI y tratamientos.
3. Aplicar cristal: solo muta el draft local; no consume inventario ni persiste.
4. Guardar documento: valida draft completo, exige motivo en ventas y llama al adaptador.
5. Errores inline junto al campo; toast reservado para éxito o fallos globales.
6. Cierre con cambios sin guardar requiere confirmación; Escape y teclado deben ser accesibles.

## Invariantes

La actualización de ventas mantiene una única transacción para revertir/reconsumir inventario e insertar los nuevos ítems. Autorización, estado de venta, protección de pagos y auditoría post-commit no se trasladan al cliente ni se debilitan por la abstracción visual.

## Pruebas

Cubrir contrato/adaptadores, validación física, advertencias de rango y confirmación, dirty state, payload de reemplazo, parent/child de tratamientos, errores remotos y flujo de venta fuera de rango que guarda exitosamente. Añadir cobertura e2e antes de conectar el adaptador completo de quotes.
