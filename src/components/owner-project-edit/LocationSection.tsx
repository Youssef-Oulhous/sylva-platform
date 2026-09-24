import { getTranslations } from 'next-intl/server';
import FormSection from './FormSection';
import FigureField from './FigureField';
import { FieldRow, FileField, Note, SelectField, TextField } from './Fields';
import { COUNTRIES, LOCATION, SECTION } from './project-draft-data';

/**
 * Location and geometry.
 *
 * Location is what the water-dependent buyers rank first (concept note, section
 * 3), and the catchment is how they search, so the catchment is a required field
 * rather than a note inside the summary. Both geometries are uploaded as GeoJSON
 * because the project page offers the boundary as a download.
 */
export default async function LocationSection() {
  const t = await getTranslations('ownerProjectForm');
  const tRoot = await getTranslations();

  return (
    <FormSection
      id={SECTION.location}
      n={2}
      title={t('section.location.title')}
      lead={t('section.location.lead')}
    >
      <FieldRow>
        <SelectField
          id="country"
          label={tRoot('projects.filters.country')}
          defaultValue={LOCATION.countryCode}
          options={COUNTRIES.map((country) => ({
            value: country.code,
            label: t(country.nameKey),
          }))}
          required
        />
        <TextField
          id="region"
          label={t('field.region')}
          hint={t('field.regionHint')}
          defaultValue={LOCATION.region}
          required
        />
      </FieldRow>

      <FieldRow>
        <TextField
          id="catchment"
          label={tRoot('project.catchment')}
          hint={t('field.catchmentHint')}
          defaultValue={LOCATION.catchment}
          required
        />
        <TextField
          id="gauge"
          label={t('field.gauge')}
          hint={t('field.gaugeHint')}
          defaultValue={LOCATION.gaugeRef}
          mono
          optional
        />
      </FieldRow>

      <FigureField
        figure={LOCATION.area}
        label={t('field.area')}
        hint={t('field.areaHint')}
        required
      />

      <FigureField
        figure={LOCATION.catchmentArea}
        label={t('field.catchmentArea')}
        hint={t('field.catchmentAreaHint')}
      />

      <FieldRow>
        <FileField
          id="boundary-file"
          label={t('field.boundaryFile')}
          hint={t('field.boundaryFileHint')}
          accept=".geojson,.json,application/geo+json"
          file={LOCATION.boundaryFile}
          emptyNote={t('field.noFile')}
          required
        />
        <FileField
          id="catchment-file"
          label={t('field.catchmentFile')}
          hint={t('field.catchmentFileHint')}
          accept=".geojson,.json,application/geo+json"
          file={LOCATION.catchmentFile}
          emptyNote={t('field.noFile')}
          required
        />
      </FieldRow>

      <Note>{t('field.geometryNote')}</Note>
    </FormSection>
  );
}
