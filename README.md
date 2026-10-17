# App de cotizaciones

Herramienta interna para presentar eventos en vivo en 3D. Incluye diagrama de señal, lista de equipos, cotización, plan de personal y cronograma de montaje.

> Todo en esta carpeta usa **datos y precios ficticios**. No hay información de clientes reales.

## Datos (paso 1)

| Archivo | Para qué sirve |
|---|---|
| `datos/catalogo.json` | Catálogo editable: equipos, roles de personal y configuración del impuesto. La app lo lee. |
| `datos/catalogo.csv` | Vista del catálogo en tabla para revisarlo en Excel o Sheets. |
| `datos/proyecto-ejemplo.json` | Ejemplo de proyecto con recinto, equipos colocados, conexiones, personal y cronograma. |

### Reglas de precios
- `precio_compra_oficial_usd` es el precio de lista del fabricante. Es **solo referencia** y nunca entra en la cotización.
  - Los precios de Blackmagic se tomaron de blackmagicdesign.com/products el 17 de octubre de 2026.
  - Su estado es `consultado_por_confirmar`.
- `tarifa_renta_dia_usd` es la tarifa con la que se cotiza. Hoy todas tienen el estado `ejemplo` y así se muestran en pantalla y en el PDF.
- Cada línea de la cotización vale tarifa diaria × días × unidades. Los días se fijan por proyecto (`dias_renta`) y las unidades por línea. `ajustes_tarifa` cambia una tarifa solo para ese proyecto.
- Impuesto: el campo `tasa` está en `null` porque todavía está por definir.

### Recinto
`recinto.tipo = "generico"` usa las medidas y las zonas editables. El bloque `recinto.plano` está reservado para subir un plano real con su escala, su origen y su rotación, así la ampliación no obliga a cambiar el formato de los proyectos.
