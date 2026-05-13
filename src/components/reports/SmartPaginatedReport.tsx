import { useMemo } from 'react';
import { ResultCategory } from '../../hooks/useLabReport';

/**
 * Configuration for page layout calculations
 */
interface PageConfig {
  /** Approximate height in mm for header section */
  headerHeight: number;
  /** Approximate height in mm for patient info section */
  patientInfoHeight: number;
  /** Approximate height in mm for footer section */
  footerHeight: number;
  /** Approximate height in mm for category title */
  categoryTitleHeight: number;
  /** Approximate height in mm for panel header row */
  panelHeaderHeight: number;
  /** Approximate height in mm for table header row */
  tableHeaderHeight: number;
  /** Approximate height in mm per test result row */
  testRowHeight: number;
  /** Total available page height in mm (A4 = 297mm) */
  totalPageHeight: number;
  /** Margins (top + bottom) in mm */
  margins: number;
  /** Maximum tests in a panel before allowing split (default: 50 - never split FBC) */
  maxTestsBeforeSplit: number;
}

/**
 * Default page configuration based on A4 portrait with 10mm margins
 */
const DEFAULT_PAGE_CONFIG: PageConfig = {
  headerHeight: 35,
  patientInfoHeight: 28,
  footerHeight: 22,
  categoryTitleHeight: 12,
  panelHeaderHeight: 8,
  tableHeaderHeight: 7,
  testRowHeight: 6.5,
  totalPageHeight: 297,
  margins: 20, // 10mm top + 10mm bottom
  maxTestsBeforeSplit: 50, // Never split FBC (24 tests) - keep panels together
};

/**
 * Represents a page of test results
 */
export interface ReportPage {
  pageNumber: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  categories: PageCategory[];
}

/**
 * Represents a category section on a page
 */
export interface PageCategory {
  category: string;
  categoryDisplayName: string;
  isFirstOccurrence: boolean; // First time this category appears
  isContinuation: boolean; // Continuation from previous page
  panels: PagePanel[];
}

/**
 * Represents a panel section on a page
 */
export interface PagePanel {
  panelCode?: string;
  panelName?: string;
  isFirstOccurrence: boolean;
  isContinuation: boolean;
  results: any[]; // Test results
}

/**
 * Calculate how many tests fit on a page
 */
function calculateTestsPerPage(
  config: PageConfig,
  isFirstPage: boolean,
  hasCategoryTitle: boolean,
  hasPanelHeader: boolean
): number {
  let availableHeight = config.totalPageHeight - config.margins - config.footerHeight;

  // First page includes header and patient info
  if (isFirstPage) {
    availableHeight -= config.headerHeight + config.patientInfoHeight;
  } else {
    // Subsequent pages have smaller header
    availableHeight -= config.headerHeight * 0.6; // Reduced header
  }

  // Subtract category title if present
  if (hasCategoryTitle) {
    availableHeight -= config.categoryTitleHeight;
  }

  // Subtract panel header if present
  if (hasPanelHeader) {
    availableHeight -= config.panelHeaderHeight;
  }

  // Subtract table header
  availableHeight -= config.tableHeaderHeight;

  // Calculate number of test rows that fit
  const testsPerPage = Math.floor(availableHeight / config.testRowHeight);

  // Return realistic number - first page ~20-25 tests, subsequent ~30-35 tests
  const maxTests = isFirstPage ? 25 : 35;
  return Math.min(Math.max(testsPerPage, 5), maxTests);
}

/**
 * Calculate space needed for a panel (in test row units)
 */
function calculatePanelSpace(
  panel: { results: any[] },
  config: PageConfig,
  needsPanelHeader: boolean
): number {
  let space = panel.results.length; // Test rows

  // Add space for panel header if needed
  if (needsPanelHeader) {
    space += Math.ceil(config.panelHeaderHeight / config.testRowHeight);
  }

  // Add space for table header
  space += Math.ceil(config.tableHeaderHeight / config.testRowHeight);

  return space;
}

/**
 * Smart pagination algorithm
 * Keeps panels together - only splits panels if they exceed maxTestsBeforeSplit
 * Groups individual tests together and keeps them on the same page
 */
export function usePaginatedReport(
  resultsByCategory: ResultCategory[],
  config: PageConfig = DEFAULT_PAGE_CONFIG
): ReportPage[] {
  return useMemo(() => {
    const pages: ReportPage[] = [];
    let currentPage: ReportPage = {
      pageNumber: 1,
      isFirstPage: true,
      isLastPage: false,
      categories: [],
    };

    // Track actual space used on current page
    let testsOnCurrentPage = 0;
    const maxTestsFirstPage = 26; // Increased due to compact layout - FBC (24) + overhead fits
    const maxTestsPerPage = 35; // More tests fit with compact layout
    
    const categoryOccurrences = new Map<string, number>();
    const panelOccurrences = new Map<string, number>();

    for (const category of resultsByCategory) {
      const categoryKey = category.category;
      const isFirstCategoryOccurrence = !categoryOccurrences.has(categoryKey);
      categoryOccurrences.set(categoryKey, (categoryOccurrences.get(categoryKey) || 0) + 1);

      // Group results by panel
      const panelGroups = groupResultsByPanel(category.results);

      // Separate panels from individual tests
      const panels = panelGroups.filter(g => !g.isIndividualTest);
      const individualTests = panelGroups.filter(g => g.isIndividualTest);

      // RULE: Categories cannot mix - if current page has content from different category, start new page
      if (currentPage.categories.length > 0) {
        const lastCategory = currentPage.categories[currentPage.categories.length - 1];
        if (lastCategory.category !== categoryKey && testsOnCurrentPage > 0) {
          pages.push(currentPage);
          currentPage = {
            pageNumber: pages.length + 1,
            isFirstPage: false,
            isLastPage: false,
            categories: [],
          };
          testsOnCurrentPage = 0;
        }
      }

      let currentPageCategory: PageCategory | null = null;

      // Process panels first
      for (const panelGroup of panels) {
        const panelKey = `${categoryKey}_${panelGroup.panelCode || panelGroup.panelName}`;
        const isFirstPanelOccurrence = !panelOccurrences.has(panelKey);
        const panelTestCount = panelGroup.results.length;

        // Calculate space needed for this panel (tests + overhead)
        const panelOverhead = 3; // Panel header + table header + spacing
        const panelTotalSpace = panelTestCount + panelOverhead;

        // Determine if this panel can be split
        const canSplitPanel = panelTestCount > config.maxTestsBeforeSplit;

        // Get max tests for current page type
        const maxTests = currentPage.pageNumber === 1 ? maxTestsFirstPage : maxTestsPerPage;

        if (canSplitPanel) {
          // Handle large panels that need splitting (rare case)
          let remainingTests = [...panelGroup.results];
          let isFirstChunk = true;

          while (remainingTests.length > 0) {
            const spaceAvailable = currentPage.pageNumber === 1 ? maxTestsFirstPage : maxTestsPerPage;
            const testsToAdd = Math.min(remainingTests.length, spaceAvailable - testsOnCurrentPage);

            if (testsToAdd <= 0 || testsOnCurrentPage >= spaceAvailable) {
              // Start new page
              pages.push(currentPage);
              currentPage = {
                pageNumber: pages.length + 1,
                isFirstPage: false,
                isLastPage: false,
                categories: [],
              };
              currentPageCategory = null;
              testsOnCurrentPage = 0;
              continue;
            }

            // Create or get current page category
            if (!currentPageCategory) {
              currentPageCategory = {
                category: categoryKey,
                categoryDisplayName: category.categoryDisplayName,
                isFirstOccurrence: isFirstCategoryOccurrence && currentPage.pageNumber === 1,
                isContinuation: !isFirstCategoryOccurrence || currentPage.pageNumber > 1,
                panels: [],
              };
              currentPage.categories.push(currentPageCategory);
            }

            // Add panel chunk
            const testsForThisPage = remainingTests.slice(0, testsToAdd);
            currentPageCategory.panels.push({
              panelCode: panelGroup.panelCode,
              panelName: panelGroup.panelName,
              isFirstOccurrence: isFirstChunk,
              isContinuation: !isFirstChunk,
              results: testsForThisPage,
            });

            remainingTests = remainingTests.slice(testsToAdd);
            testsOnCurrentPage += testsToAdd + (isFirstChunk ? panelOverhead : 1);
            isFirstChunk = false;
          }

          panelOccurrences.set(panelKey, (panelOccurrences.get(panelKey) || 0) + 1);
        } else {
          // Keep entire panel together (normal case)
          
          // Check if panel fits on current page
          const wouldExceedLimit = (testsOnCurrentPage + panelTotalSpace) > maxTests;
          
          // If panel doesn't fit on current page AND we already have content, start new page
          if (wouldExceedLimit && testsOnCurrentPage > 0) {
            pages.push(currentPage);
            currentPage = {
              pageNumber: pages.length + 1,
              isFirstPage: false,
              isLastPage: false,
              categories: [],
            };
            currentPageCategory = null;
            testsOnCurrentPage = 0;
          }

          // Create or get current page category
          if (!currentPageCategory) {
            currentPageCategory = {
              category: categoryKey,
              categoryDisplayName: category.categoryDisplayName,
              isFirstOccurrence: isFirstCategoryOccurrence && currentPage.pageNumber === 1,
              isContinuation: !isFirstCategoryOccurrence || currentPage.pageNumber > 1,
              panels: [],
            };
            currentPage.categories.push(currentPageCategory);
          }

          // Add entire panel to current page
          currentPageCategory.panels.push({
            panelCode: panelGroup.panelCode,
            panelName: panelGroup.panelName,
            isFirstOccurrence: isFirstPanelOccurrence,
            isContinuation: false,
            results: panelGroup.results,
          });

          panelOccurrences.set(panelKey, (panelOccurrences.get(panelKey) || 0) + 1);
          testsOnCurrentPage += panelTotalSpace;
        }
      }

      // Process individual tests as a group
      if (individualTests.length > 0) {
        // Flatten all individual tests into one array
        const allIndividualTests = individualTests.flatMap(g => g.results);
        
        // Calculate total space needed for all individual tests
        const individualTestsOverhead = 2; // Table header + spacing
        const totalIndividualSpace = allIndividualTests.length + individualTestsOverhead;

        const maxTests = currentPage.pageNumber === 1 ? maxTestsFirstPage : maxTestsPerPage;
        
        // Check if individual tests fit on current page
        const wouldExceedLimit = (testsOnCurrentPage + totalIndividualSpace) > maxTests;

        // If individual tests don't all fit on current page AND we have content, move them to new page
        if (wouldExceedLimit && testsOnCurrentPage > 0) {
          pages.push(currentPage);
          currentPage = {
            pageNumber: pages.length + 1,
            isFirstPage: false,
            isLastPage: false,
            categories: [],
          };
          currentPageCategory = null;
          testsOnCurrentPage = 0;
        }

        // Create or get current page category
        if (!currentPageCategory) {
          currentPageCategory = {
            category: categoryKey,
            categoryDisplayName: category.categoryDisplayName,
            isFirstOccurrence: isFirstCategoryOccurrence && currentPage.pageNumber === 1,
            isContinuation: !isFirstCategoryOccurrence || currentPage.pageNumber > 1,
            panels: [],
          };
          currentPage.categories.push(currentPageCategory);
        }

        // Add all individual tests as one group (no panel header)
        currentPageCategory.panels.push({
          panelCode: undefined,
          panelName: undefined,
          isFirstOccurrence: true,
          isContinuation: false,
          results: allIndividualTests,
        });

        testsOnCurrentPage += totalIndividualSpace;
      }
    }

    // Add the last page
    if (currentPage.categories.length > 0) {
      pages.push(currentPage);
    }

    // Mark the last page
    if (pages.length > 0) {
      pages[pages.length - 1].isLastPage = true;
    }

    return pages;
  }, [resultsByCategory, config]);
}

/**
 * Group results by panel
 */
function groupResultsByPanel(results: any[]): Array<{
  panelCode?: string;
  panelName?: string;
  isIndividualTest: boolean;
  results: any[];
}> {
  const groups = new Map<string, any[]>();

  for (const result of results) {
    const key = result.panelCode || result.panelName || '__UNGROUPED__';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(result);
  }

  return Array.from(groups.entries()).map(([key, results]) => ({
    panelCode: results[0]?.panelCode,
    panelName: results[0]?.panelName,
    isIndividualTest: key === '__UNGROUPED__',
    results,
  }));
}

/**
 * Get continuation text for category/panel headers
 */
export function getContinuationText(isContinuation: boolean): string {
  return isContinuation ? ' (continued)' : '';
}
