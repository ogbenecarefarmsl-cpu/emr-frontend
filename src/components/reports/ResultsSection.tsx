import { ResultCategory } from '../../hooks/useLabReport';
import { ReportTemplate } from '../../hooks/useReportTemplates';
import { CategorySection } from './CategorySection';

interface ResultsSectionProps {
  resultsByCategory: ResultCategory[];
  template?: ReportTemplate;
}

export function ResultsSection({ resultsByCategory, template }: ResultsSectionProps) {
  return (
    <div className="results-section mb-6">
      {resultsByCategory.map((category, index) => (
        <CategorySection 
          key={category.category} 
          category={category}
          template={template}
          pageBreakBefore={index > 0}
        />
      ))}
    </div>
  );
}
