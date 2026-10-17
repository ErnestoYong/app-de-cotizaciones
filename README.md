# App de cotizaciones

Herramienta interna para presentar eventos en vivo en 3D. Incluye diagrama de señal, lista de equipos, cotización, plan de personal y cronograma de montaje.

> Todo en esta carpeta usa **datos y precios ficticios**. No hay información de clientes reales.

## Cómo se usa

1. Abre la app (en GitHub Pages, o en tu computadora con `python3 -m http.server` dentro de esta carpeta, y luego entra a http://localhost:8000).
2. **Catálogo:** busca un equipo y pulsa *Agregar*. Aparece en el centro del recinto.
3. **En la escena:** haz clic en un equipo para editarlo y arrástralo para moverlo. Puedes cambiar unidades, medidas de LED, altura, giro y tarifa del proyecto.
4. **Proyecto:** pon el nombre, el cliente, los días de renta, el impuesto (déjalo vacío si está por definir) y el tipo y medidas del recinto.
5. **Cotización:** se calcula sola con tarifa diaria × días × unidades.
6. **Presentar:** muestra la escena a pantalla completa con el nombre del proyecto y el total. Sales con *Esc*.
7. **Guardar archivo / Abrir archivo:** el proyecto se guarda solo en el navegador. Exporta un archivo `.json` para tener respaldo o cambiar de computadora.

three.js (licencia MIT) va incluido en `vendor/`, así la app no depende de internet para cargar el 3D.

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
