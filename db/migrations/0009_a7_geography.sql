-- ============================================================================
-- A7. GEOGRAPHY  ·  SRID 4326 everywhere, geodesic metres on ::geography
-- ============================================================================
CREATE TYPE geo.geometry_kind AS ENUM ('boundary','catchment');

CREATE TABLE geo.project_geometry (
  project_id      uuid NOT NULL REFERENCES proj.project(id),
  kind            geo.geometry_kind NOT NULL,
  version_no      int  NOT NULL CHECK (version_no >= 1),
  prev_version_no int GENERATED ALWAYS AS
                  (CASE WHEN version_no = 1 THEN NULL ELSE version_no - 1 END) STORED,
  geom            geometry(MultiPolygon, 4326) NOT NULL,
  -- the uploaded GeoJSON is kept verbatim as a document version, so the public
  -- download is the source file rather than a re-serialisation
  geojson_document_version_id uuid,                   -- FK added after doc
  -- the catchment dataset is NAMED, because picking one silently would be making
  -- a hydrological claim we are not entitled to make
  dataset_name    text,
  source_ref_id   uuid NOT NULL REFERENCES sylva.source_ref(id),
  source_licence  sylva.nonblank NOT NULL,
  as_of_date      date NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, kind, version_no),
  CONSTRAINT geom_is_valid   CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom)),
  CONSTRAINT geom_is_bounded CHECK (ST_NPoints(geom) <= 200000),
  CONSTRAINT catchment_names_its_dataset
    CHECK (kind <> 'catchment' OR btrim(coalesce(dataset_name,'')) <> ''),
  FOREIGN KEY (project_id, kind, prev_version_no)
    REFERENCES geo.project_geometry (project_id, kind, version_no)
);
CREATE INDEX ix_project_geometry_gix ON geo.project_geometry USING gist ((geom::geography));
CREATE INDEX ix_project_geometry_current ON geo.project_geometry (project_id, kind, version_no DESC);

-- A buyer's own production sites. Commercially sensitive location data, and the
-- most likely vector for the buyer-to-buyer leakage the note names as the
-- failure most to be avoided.
CREATE TABLE geo.buyer_site (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org.organisation(id) ON DELETE RESTRICT,
  label         sylva.nonblank NOT NULL,
  country_code  sylva.country_code NOT NULL,
  geom          geometry(Point, 4326) NOT NULL,
  source_ref_id uuid NOT NULL REFERENCES sylva.source_ref(id),
  registered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_point_valid CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))
);
CREATE INDEX ix_buyer_site_org ON geo.buyer_site (org_id);   -- the RLS predicate column
CREATE INDEX ix_buyer_site_gix ON geo.buyer_site USING gist ((geom::geography));

-- SECURITY INVOKER on purpose: geo.buyer_site's RLS policy then applies to the
-- caller, so a buyer can only ever measure from its OWN sites. The definition is
-- fixed and printed beside the number on the page: straight-line geodesic
-- distance on the WGS84 spheroid, from the site point to the NEAREST POINT of
-- the current project boundary, in metres (0 when the site lies inside).
CREATE FUNCTION geo.site_distance_m(p_site_id uuid, p_project_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER AS
$$
  SELECT round(ST_Distance(s.geom::geography, g.geom::geography)::numeric, 0)
    FROM geo.buyer_site s
    CROSS JOIN LATERAL (
      SELECT pg.geom FROM geo.project_geometry pg
       WHERE pg.project_id = p_project_id AND pg.kind = 'boundary'
       ORDER BY pg.version_no DESC LIMIT 1) g
   WHERE s.id = p_site_id
$$;

CREATE FUNCTION geo.project_boundary_geojson(p_project_id uuid) RETURNS jsonb
LANGUAGE sql STABLE AS
$$
  SELECT jsonb_build_object(
           'type','Feature',
           'geometry', ST_AsGeoJSON(g.geom)::jsonb,
           'properties', jsonb_build_object(
              'project_id', g.project_id, 'source', sr.label,
              'licence', g.source_licence, 'as_of_date', g.as_of_date))
    FROM geo.project_geometry g
    JOIN sylva.source_ref sr ON sr.id = g.source_ref_id
   WHERE g.project_id = p_project_id AND g.kind = 'boundary'
   ORDER BY g.version_no DESC LIMIT 1
$$;
