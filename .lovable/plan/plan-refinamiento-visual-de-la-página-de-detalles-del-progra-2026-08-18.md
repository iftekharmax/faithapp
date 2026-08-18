# Plan: Refinamiento Visual de la Página de Detalles del Programa

Basado en el feedback del usuario, se realizará un refinamiento visual para mejorar el contraste, la tipografía y el espaciado, buscando una estética más profesional y atractiva.

## Mejoras Visuales Propuestas

### 1. Refinamiento de la Jerarquía Tipográfica
- Aumentar el contraste entre los encabezados y el texto del cuerpo.
- Ajustar los tamaños de fuente para una mejor legibilidad (especialmente en las secciones de requisitos y descripción).
- Utilizar pesos de fuente más definidos para guiar la vista.

### 2. Optimización de Espacios y Márgenes
- Incrementar el padding interno en las tarjetas para que el contenido "respire" mejor.
- Ajustar la separación entre secciones para evitar una sensación de amontonamiento.
- Mejorar el alineamiento de los iconos con el texto.

### 3. Mejora de Colores y Contrastes
- Utilizar tonos de azul y gris más profundos para los textos secundarios.
- Refinar los fondos de las secciones destacadas (como Becas) para que resalten sin distraer.
- Ajustar las sombras y bordes para dar una sensación de profundidad más sutil y elegante.

### 4. Detalles de Componentes
- Refinar el diseño de las tarjetas de costos (Fee Cards) para que la información numérica sea más legible.
- Mejorar el estilo de los botones de acción (Compartir, Editar, Eliminar) para que sean más consistentes con el diseño premium.
- Pulir el diseño de las insignias (badges) de estado y nivel de grado.

## Tareas Técnicas
- Modificar `src/routes/_authenticated.universities.$universityId.programs.$programId/index.tsx`.
- Ajustar clases de Tailwind CSS para espaciado (`p-`, `m-`, `gap-`) y tipografía (`text-`, `font-`, `leading-`).
- Refinar estilos de `framer-motion` para que las transiciones sean más sutiles.
