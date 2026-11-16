CREATE TABLE public.traffic_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  intensity text NOT NULL,
  location_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT traffic_reports_latitude_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT traffic_reports_longitude_range CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT traffic_reports_intensity_check CHECK (intensity IN ('light', 'moderate', 'heavy')),
  CONSTRAINT traffic_reports_location_label_length CHECK (location_label IS NULL OR char_length(location_label) <= 120)
);
GRANT SELECT, INSERT ON public.traffic_reports TO anon, authenticated;
GRANT ALL ON public.traffic_reports TO service_role;
ALTER TABLE public.traffic_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read community traffic reports"
  ON public.traffic_reports FOR SELECT
  TO anon, authenticated
  USING (true);
CREATE POLICY "Anyone can submit a location traffic report"
  ON public.traffic_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    latitude BETWEEN 20.001 AND 20.018
    AND longitude BETWEEN 73.779 AND 73.808
    AND intensity IN ('light', 'moderate', 'heavy')
    AND (location_label IS NULL OR char_length(location_label) <= 120)
  );
CREATE INDEX traffic_reports_created_at_idx ON public.traffic_reports (created_at DESC);
CREATE INDEX traffic_reports_location_idx ON public.traffic_reports (latitude, longitude);
ALTER PUBLICATION supabase_realtime ADD TABLE public.traffic_reports;