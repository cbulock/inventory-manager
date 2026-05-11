insert into public.project_types (id, label, description, sort_order)
values
  ('general-crafting', 'Crafting', 'Flexible catch-all project type for mixed-supply inventories and workshop-style projects.', 1),
  ('knitting', 'Knitting', 'Yarn-based projects for garments, accessories, and gifts.', 2),
  ('crochet', 'Crochet', 'Hook-based yarn projects for wearables, toys, blankets, and decor.', 3),
  ('cardmaking', 'Card Making', 'Paper craft projects centered on cards, embellishments, and mailed sets.', 4),
  ('jewelry', 'Jewelry', 'Bead, wire, and findings-based projects for wearable accessories.', 5),
  ('sewing', 'Sewing', 'Fabric and pattern-based projects for garments, quilts, and home goods.', 6),
  ('embroidery', 'Embroidery', 'Hoop, floss, stabilizer, and needle-based stitched projects.', 7),
  ('painting', 'Painting & Mixed Media', 'Paint, surfaces, brushes, mediums, and finishing supplies.', 8)
on conflict (id) do update
set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.suggested_items (id, project_type_id, name, default_unit, description)
values
  ('craft-supplies', 'general-crafting', 'General Supplies', 'units', 'Flexible supply placeholder for mixed-material projects.'),
  ('craft-tools', 'general-crafting', 'Tools', 'units', 'Reusable hand tools or fixtures needed for the project.'),
  ('craft-packaging', 'general-crafting', 'Packaging', 'packs', 'Labels, sleeves, cards, or shipping-ready packaging.'),
  ('craft-adhesive', 'general-crafting', 'Adhesive', 'packs', 'General adhesive for assembly and finishing.'),
  ('knit-yarn', 'knitting', 'Yarn', 'skeins', 'Primary fiber supply, tracked by skein or ball.'),
  ('knit-needles', 'knitting', 'Knitting Needles', 'pairs', 'Straight, circular, or interchangeable needle sets.'),
  ('knit-markers', 'knitting', 'Stitch Markers', 'packs', 'Reusable markers for repeat sections and increases.'),
  ('knit-blocking', 'knitting', 'Blocking Mats', 'sets', 'Finishing tools used when shaping completed knits.'),
  ('crochet-yarn', 'crochet', 'Yarn', 'skeins', 'Primary fiber supply for crochet garments, blankets, and amigurumi.'),
  ('crochet-hooks', 'crochet', 'Crochet Hooks', 'sets', 'Hook sets sized for different yarn weights and patterns.'),
  ('crochet-stuffing', 'crochet', 'Stuffing', 'bags', 'Fiber fill used for toys, ornaments, and shaped projects.'),
  ('crochet-markers', 'crochet', 'Stitch Markers', 'packs', 'Markers used for rounds, increases, and section tracking.'),
  ('card-cardstock', 'cardmaking', 'Cardstock', 'packs', 'Base paper stock for cards and inserts.'),
  ('card-adhesive', 'cardmaking', 'Adhesive', 'packs', 'Tape runner, glue, or foam adhesive used for assembly.'),
  ('card-envelopes', 'cardmaking', 'Envelopes', 'packs', 'A2, slimline, or specialty envelope assortments.'),
  ('card-ink', 'cardmaking', 'Ink Pads', 'pads', 'Dye, pigment, or hybrid inks for stamping and blending.'),
  ('jewel-hooks', 'jewelry', 'Ear Hooks', 'pairs', 'Hypoallergenic or plated hooks used for earrings.'),
  ('jewel-wire', 'jewelry', 'Jewelry Wire', 'spools', 'Wire for wrapping, linking, or shaping designs.'),
  ('jewel-jumprings', 'jewelry', 'Jump Rings', 'packs', 'Connector rings for clasps, charms, and components.'),
  ('jewel-beads', 'jewelry', 'Beads', 'strands', 'Primary decorative beads or focal components.'),
  ('sew-fabric', 'sewing', 'Fabric', 'yards', 'Main fabric supply for garments or quilting.'),
  ('sew-thread', 'sewing', 'Thread', 'spools', 'General construction or topstitch thread.'),
  ('sew-patterns', 'sewing', 'Patterns', 'copies', 'Printed or digital patterns used by the project.'),
  ('sew-interfacing', 'sewing', 'Interfacing', 'yards', 'Stabilizer for collars, bags, and structure.'),
  ('embroider-floss', 'embroidery', 'Embroidery Floss', 'skeins', 'Thread used for stitched motifs, monograms, and samplers.'),
  ('embroider-hoops', 'embroidery', 'Embroidery Hoops', 'sets', 'Hoops or frames used to tension fabric while stitching.'),
  ('embroider-needles', 'embroidery', 'Embroidery Needles', 'packs', 'Sharp and blunt needles sized for floss and fabric count.'),
  ('embroider-stabilizer', 'embroidery', 'Stabilizer', 'sheets', 'Backing or topper materials used for support and finishing.'),
  ('paint-acrylic', 'painting', 'Acrylic Paint', 'bottles', 'Fast-drying paint for canvas, wood, and mixed-media work.'),
  ('paint-brushes', 'painting', 'Brushes', 'sets', 'Brush sets for detail work, washes, and texture.'),
  ('paint-canvas', 'painting', 'Canvas Panels', 'packs', 'Paint-ready surfaces for studies, gifts, and finished pieces.'),
  ('paint-medium', 'painting', 'Mediums & Sealers', 'bottles', 'Mediums, varnishes, or sealers used for texture and finish.')
on conflict (id) do update
set
  project_type_id = excluded.project_type_id,
  name = excluded.name,
  default_unit = excluded.default_unit,
  description = excluded.description;
