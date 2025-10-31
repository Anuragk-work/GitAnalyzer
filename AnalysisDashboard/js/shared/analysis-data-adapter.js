/**
 * AnalysisData Adapter - Transforms AnalysisData format to dashboard format
 * Handles dynamic repository discovery and data transformation
 */

class AnalysisDataAdapter {
    constructor() {
        // Use relative path that works from both root and subdirectories
        // Try both '../AnalysisData' and 'AnalysisData' to handle different server setups
        this.basePath = 'AnalysisData';  // Changed from '../AnalysisData' - matches DeveloperIndex pattern
        this.repositories = [];
        this.repositoryData = new Map();
        this.initialized = false;
    }

    /**
     * Discover available repositories in AnalysisData folder
     * Since we can't list directories from client-side JS, we try multiple approaches:
     * 1. Check for repositories.json manifest file
     * 2. Try common repository folder names
     * 3. Check localStorage cache if previously discovered
     */
    async discoverRepositories() {
        if (this.initialized && this.repositories.length > 0) {
            return this.repositories;
        }

        try {
            // Note: We don't use a manifest file - repositories are discovered from actual folder structure
            // by checking for commits.json files in each potential repository folder

            // Approach 2: Check localStorage cache from previous discovery
            try {
                const cached = localStorage.getItem('discoveredRepositories');
                if (cached) {
                    const cachedRepos = JSON.parse(cached);
                    if (Array.isArray(cachedRepos) && cachedRepos.length > 0) {
                        // Verify cached repos still exist
                        const verified = [];
                        for (const repo of cachedRepos) {
                            try {
                                const testPath = `${this.basePath}/${repo}/commits.json`;
                                const response = await fetch(testPath, { method: 'HEAD' });
                                if (response.ok) {
                                    verified.push(repo);
                                }
                            } catch (e) {
                                // Repository no longer exists, skip
                            }
                        }
                        if (verified.length > 0) {
                            this.repositories = verified;
                            console.log(`📁 Using cached repositories: ${verified.length} repositories`);
                            this.initialized = true;
                            return this.repositories;
                        }
                    }
                }
            } catch (e) {
                console.log('Could not access localStorage cache');
            }

            // Approach 3: Dynamic discovery by probing for commits.json files in known/common repository folders
            console.log('🔍 Probing AnalysisData folder structure for repositories...');
            
            const discovered = [];
            const testedNames = new Set();
            
            // Strategy 1: Try cached repository names from localStorage (if any) - verify they still exist
            try {
                const cached = localStorage.getItem('discoveredRepositories');
                if (cached) {
                    const cachedNames = JSON.parse(cached);
                    if (Array.isArray(cachedNames)) {
                        cachedNames.forEach(name => testedNames.add(name));
                    }
                }
            } catch (e) {
                // Ignore localStorage errors
            }
            
            // Strategy 2: Probe known/common repository folder names
            // Start with common patterns and known repositories
            const knownRepositories = [
                'newrelic-dotnet-agent',
                'newrelic-ruby-agent',
                'newrelic-java-agent',
                'newrelic-nodejs-agent',
                'newrelic-python-agent',
                'newrelic-php-agent',
                'newrelic-go-agent'
            ];
            
            // Combine known repos with cached names, avoiding duplicates
            const reposToProbe = [...new Set([...knownRepositories, ...Array.from(testedNames)])];
            
            console.log(`🔍 Probing ${reposToProbe.length} potential repositories...`);
            
            // Probe all repositories in parallel
            const probePromises = reposToProbe.map(async (repoName) => {
                try {
                    const testPath = `${this.basePath}/${repoName}/commits.json`;
                    const response = await fetch(testPath, { method: 'HEAD' });
                    if (response.ok) {
                        return repoName;
                    }
                } catch (e) {
                    // Repository doesn't exist, return null
                }
                return null;
            });
            
            const probeResults = await Promise.all(probePromises);
            const foundRepos = probeResults.filter(repo => repo !== null);
            
            if (foundRepos.length > 0) {
                discovered.push(...foundRepos);
                foundRepos.forEach(repo => {
                    console.log(`✅ Discovered repository: ${repo}`);
                    testedNames.add(repo);
                });
            }
            
            // Strategy 3: Try URL parameters as additional source
            const urlParams = new URLSearchParams(window.location.search);
            const reposParam = urlParams.get('repos');
            if (reposParam) {
                const reposFromUrl = reposParam.split(',').map(r => r.trim()).filter(r => r);
                console.log(`🔍 Found repository names in URL: ${reposFromUrl.join(', ')}`);
                for (const repoName of reposFromUrl) {
                    if (!testedNames.has(repoName) && !discovered.includes(repoName)) {
                        try {
                            const testPath = `${this.basePath}/${repoName}/commits.json`;
                            const response = await fetch(testPath, { method: 'HEAD' });
                            if (response.ok) {
                                discovered.push(repoName);
                                console.log(`✅ Discovered repository from URL: ${repoName}`);
                            }
                        } catch (e) {
                            // Repository doesn't exist, skip
                        }
                    }
                }
            }

            // Cache discovered repositories for future loads
            if (discovered.length > 0) {
                this.repositories = discovered;
                try {
                    localStorage.setItem('discoveredRepositories', JSON.stringify(discovered));
                } catch (e) {
                    // localStorage not available, ignore
                }
                console.log(`✅ Discovered ${discovered.length} repository/repositories from folder structure:`, discovered);
            } else {
                console.warn('⚠️ No repositories discovered. To enable discovery:');
                console.warn('   1. Add repositories via URL: ?repos=repo1,repo2');
                console.warn('   2. Set localStorage: localStorage.setItem("discoveredRepositories", JSON.stringify(["repo1","repo2"]))');
                console.warn('   3. Implement a server endpoint to list AnalysisData subdirectories');
                console.warn('   Once discovered, repository names will be cached automatically.');
                this.repositories = [];
            }

            this.initialized = true;
            return this.repositories;
        } catch (error) {
            console.error('Error discovering repositories:', error);
            return [];
        }
    }

    /**
     * Transform developer_rankings.json to developer_contributions.json format
     */
    transformDeveloperData(rankingsData) {
        if (!rankingsData || !rankingsData.rankings) {
            return {
                total_developers: 0,
                total_commits: 0,
                developers: {}
            };
        }

        const developers = {};
        let totalCommits = 0;

        rankingsData.rankings.forEach(ranking => {
            const email = ranking.email || `${ranking.developer.toLowerCase().replace(/\s+/g, '.')}@company.com`;
            const commits = ranking.metrics?.commits || 0;
            totalCommits += commits;

            developers[email] = {
                name: ranking.developer,
                email: email,
                total_commits: commits,
                commits: commits,
                country: this.extractCountry(ranking),
                organization_level: 'Corporate',
                work_types: this.extractWorkTypes(ranking),
                technologies: {},
                repositories: [rankingsData.repository],
                activity_period: {
                    first_commit: ranking.metrics?.first_commit_date || null,
                    last_commit: ranking.metrics?.last_commit_date || null
                }
            };
        });

        return {
            total_developers: rankingsData.total_developers || Object.keys(developers).length,
            total_commits: totalCommits,
            developers: developers
        };
    }

    /**
     * Transform geographic_distribution.json to regional_analysis.json format
     */
    transformRegionalData(geoData) {
        if (!geoData || !geoData.geographic_distribution) {
            return {
                total_regions: 0,
                regional_breakdown: {},
                regional_ranking: []
            };
        }

        const regionalBreakdown = {};
        let totalCommits = 0;

        geoData.geographic_distribution.forEach(dist => {
            const countries = dist.likely_countries || [];
            
            countries.forEach(country => {
                // Clean country name (remove region info)
                const cleanCountry = country.split('(')[0].trim();
                
                if (!regionalBreakdown[cleanCountry]) {
                    regionalBreakdown[cleanCountry] = {
                        commits: 0,
                        developers_count: 0,
                        developers: [],
                        repositories: [geoData.repository_name],
                        work_types: {}
                    };
                }

                regionalBreakdown[cleanCountry].commits += dist.commit_count || 0;
                regionalBreakdown[cleanCountry].developers_count = Math.max(
                    regionalBreakdown[cleanCountry].developers_count,
                    dist.unique_authors || 0
                );

                // Add top authors to developers list
                if (dist.top_authors) {
                    dist.top_authors.forEach(author => {
                        const email = author.email;
                        if (email && !regionalBreakdown[cleanCountry].developers.includes(email)) {
                            regionalBreakdown[cleanCountry].developers.push(email);
                        }
                    });
                }

                totalCommits += dist.commit_count || 0;
            });
        });

        // Create ranking
        const ranking = Object.entries(regionalBreakdown)
            .map(([country, data]) => ({
                country: country,
                commits: data.commits,
                developers_count: data.developers_count
            }))
            .sort((a, b) => b.commits - a.commits);

        return {
            total_regions: Object.keys(regionalBreakdown).length,
            regional_breakdown: regionalBreakdown,
            regional_summary: {},
            regional_ranking: ranking
        };
    }

    /**
     * Transform techStack.json to technology_stack.json format
     */
    transformTechnologyData(techStackData) {
        if (!techStackData || !techStackData.analysis || !Array.isArray(techStackData.analysis)) {
            return {
                overall_technology_usage: {},
                technology_details: {},
                technology_by_category: {
                    languages: {},
                    frameworks: {},
                    databases: {},
                    security: {},
                    networking: {},
                    platforms: {},
                    tools: {}
                }
            };
        }

        const overallUsage = {};
        const techDetails = {}; // Store actual Lines, Count, Code data
        const categories = {
            languages: {},
            frameworks: {},
            databases: {},
            security: {},
            networking: {},
            platforms: {},
            tools: {}
        };

        techStackData.analysis.forEach(tech => {
            const name = tech.Name?.toLowerCase() || '';
            const count = tech.Count || 0;
            const lines = tech.Lines || 0;
            const code = tech.Code || 0;
            
            if (count > 0) {
                overallUsage[name] = (overallUsage[name] || 0) + count;
                
                // Store actual detailed data - NO SYNTHETIC DATA
                if (!techDetails[name]) {
                    techDetails[name] = {
                        files: 0,
                        lines: 0,
                        code: 0,
                        complexity: 0
                    };
                }
                techDetails[name].files += count;
                techDetails[name].lines += lines;
                techDetails[name].code += code;
                techDetails[name].complexity += tech.Complexity || 0;

                // Categorize technology
                const category = this.categorizeTechnology(name);
                if (categories[category]) {
                    categories[category][name] = (categories[category][name] || 0) + count;
                }
            }
        });

        return {
            overall_technology_usage: overallUsage,
            technology_details: techDetails, // Real data: files, lines, code
            technology_by_category: categories
        };
    }

    /**
     * Transform commits.json to commit_analysis.json format
     */
    transformCommitData(commitsData) {
        if (!commitsData || !commitsData.commits || !Array.isArray(commitsData.commits)) {
            return {
                total_commits: 0,
                commits_by_month: {},
                work_types: {},
                commit_patterns: {}
            };
        }

        const commitsByMonth = {};
        const workTypes = {
            feature: 0,
            bug_fix: 0,
            maintenance: 0,
            documentation: 0,
            testing: 0,
            refactoring: 0,
            merge: 0,
            other: 0
        };

        commitsData.commits.forEach(commit => {
            const date = new Date(commit.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            commitsByMonth[monthKey] = (commitsByMonth[monthKey] || 0) + 1;

            // Classify work type from commit message
            const message = commit.message?.toLowerCase() || '';
            if (message.includes('fix') || message.includes('bug')) {
                workTypes.bug_fix++;
            } else if (message.includes('feat') || message.includes('feature')) {
                workTypes.feature++;
            } else if (message.includes('doc') || message.includes('readme')) {
                workTypes.documentation++;
            } else if (message.includes('test')) {
                workTypes.testing++;
            } else if (message.includes('refactor')) {
                workTypes.refactoring++;
            } else if (message.includes('merge')) {
                workTypes.merge++;
            } else if (message.includes('chore') || message.includes('maintain')) {
                workTypes.maintenance++;
            } else {
                workTypes.other++;
            }
        });

        return {
            total_commits: commitsData.total_commits || commitsData.commits.length,
            commits_by_month: commitsByMonth,
            work_types: workTypes,
            commit_patterns: {
                average_commits_per_month: Object.keys(commitsByMonth).length > 0 
                    ? commitsData.commits.length / Object.keys(commitsByMonth).length 
                    : 0
            }
        };
    }

    /**
     * Transform vulnerabilities.json to vulnerability count format
     */
    transformVulnerabilityData(vulnData) {
        if (!vulnData || !vulnData.analysis) {
            return {
                Total_vulnerability_count: 0,
                Critical_severity_count: 0,
                High_severity_count: 0,
                Medium_severity_count: 0,
                Low_severity_count: 0
            };
        }

        const summary = vulnData.analysis.summary || {};
        const severityCounts = summary.severity_counts || {};

        return {
            Total_vulnerability_count: summary.total_vulnerabilities || 0,
            Critical_severity_count: severityCounts.CRITICAL || 0,
            High_severity_count: severityCounts.HIGH || 0,
            Medium_severity_count: severityCounts.MEDIUM || 0,
            Low_severity_count: severityCounts.LOW || 0
        };
    }

    /**
     * Generate overall_summary.json from aggregated data
     */
    generateOverallSummary(developerData, regionalData, techData, commitData) {
        return {
            total_commits: commitData?.total_commits || 0,
            total_developers: developerData?.total_developers || 0,
            total_regions: regionalData?.total_regions || 0,
            tech_stack_diversity: Object.keys(techData?.overall_technology_usage || {}).length,
            retention_rate: 0, // Calculate if possible
            development_cycle: '24/7'
        };
    }

    /**
     * Load data for a specific repository
     */
    async loadRepositoryData(repositoryName) {
        if (this.repositoryData.has(repositoryName)) {
            return this.repositoryData.get(repositoryName);
        }

        try {
            const basePath = `${this.basePath}/${repositoryName}`;
            
            // Load all data files in parallel
            const [commitsData, rankingsData, geoData, techData, vulnData, complexityData] = await Promise.allSettled([
                fetch(`${basePath}/commits.json`).then(r => r.ok ? r.json() : null),
                fetch(`${basePath}/developer_rankings.json`).then(r => r.ok ? r.json() : null),
                fetch(`${basePath}/geographic_distribution.json`).then(r => r.ok ? r.json() : null),
                fetch(`${basePath}/techStack.json`).then(r => r.ok ? r.json() : null),
                fetch(`${basePath}/vulnerabilities.json`).then(r => r.ok ? r.json() : null),
                fetch(`${basePath}/complexity.json`).then(r => r.ok ? r.json() : null)
            ]);
            
            // Load CSV files for code analysis (optional - don't block if it fails)
            let csvFiles = {
                entity_churn: null,
                entity_effort: null,
                entity_ownership: null,
                fragmentation: null,
                coupling: null,
                author_churn: null,
                abs_churn: null,
                revisions: null
            };
            
            // Try to load CSVs, but don't let failures block dashboard initialization
            try {
                // Use Promise.race with timeout to prevent hanging
                const csvPromise = this.loadCodeAnalysisCSVs(basePath, repositoryName);
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => resolve(csvFiles), 2000); // 2 second timeout
                });
                csvFiles = await Promise.race([csvPromise, timeoutPromise]);
            } catch (csvError) {
                // Log but don't throw - CSV data is optional
                console.warn(`Failed to load code analysis CSVs for ${repositoryName}:`, csvError);
                // Continue with null CSV data
            }

            const transformedData = {
                repository: repositoryName,
                commits: this.transformCommitData(commitsData.value || null),
                developers: this.transformDeveloperData(rankingsData.value || null),
                regional: this.transformRegionalData(geoData.value || null),
                technology: this.transformTechnologyData(techData.value || null),
                vulnerabilities: this.transformVulnerabilityData(vulnData.value || null),
                raw_vulnerabilities: vulnData.value || null, // Store raw data for CVE list access
                complexity: complexityData.value || null, // Store raw complexity data
                code_analysis: csvFiles, // Store all CSV code analysis data
                overall_summary: null // Will be generated
            };

            // Generate overall summary
            transformedData.overall_summary = this.generateOverallSummary(
                transformedData.developers,
                transformedData.regional,
                transformedData.technology,
                transformedData.commits
            );

            this.repositoryData.set(repositoryName, transformedData);
            return transformedData;
        } catch (error) {
            console.error(`Error loading data for ${repositoryName}:`, error);
            return null;
        }
    }

    /**
     * Load code analysis CSV files
     */
    async loadCodeAnalysisCSVs(basePath, repositoryName) {
        const csvFiles = {
            entity_churn: null,
            entity_effort: null,
            entity_ownership: null,
            fragmentation: null,
            coupling: null,
            author_churn: null,
            abs_churn: null,
            revisions: null  // Add revisions.csv for commit counts by file
        };

        // CSV file patterns
        const csvPatterns = {
            entity_churn: `${basePath}/${repositoryName}_code-analysis_entity_churn.csv`,
            entity_effort: `${basePath}/${repositoryName}_code-analysis_entity_effort.csv`,
            entity_ownership: `${basePath}/${repositoryName}_code-analysis_entity_ownership.csv`,
            fragmentation: `${basePath}/${repositoryName}_code-analysis_fragmentation.csv`,
            coupling: `${basePath}/${repositoryName}_code-analysis_coupling.csv`,
            author_churn: `${basePath}/${repositoryName}_code-analysis_author_churn.csv`,
            abs_churn: `${basePath}/${repositoryName}_code-analysis_abs_churn.csv`,
            revisions: `${basePath}/${repositoryName}_code-analysis_revisions.csv`  // Load revisions.csv
        };

        // Load CSVs in parallel
        const csvPromises = Object.entries(csvPatterns).map(async ([key, path]) => {
            try {
                const response = await fetch(path);
                if (!response.ok) return { key, data: null };
                const text = await response.text();
                return { key, data: this.parseCSV(text) };
            } catch (error) {
                console.warn(`Failed to load CSV ${key}:`, error);
                return { key, data: null };
            }
        });

        const results = await Promise.allSettled(csvPromises);
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                csvFiles[result.value.key] = result.value.data;
            }
        });

        return csvFiles;
    }

    /**
     * Parse CSV text to array of objects
     */
    parseCSV(text) {
        try {
            if (!text || typeof text !== 'string') {
                return [];
            }
            
            const lines = text.trim().split('\n');
            if (lines.length < 2) return [];

            const headers = lines[0].split(',').map(h => h.trim());
            if (!headers || headers.length === 0) return [];
            
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                try {
                    const values = this.parseCSVLine(lines[i]);
                    if (!values || values.length !== headers.length) continue;
                    
                    const row = {};
                    headers.forEach((header, index) => {
                        const value = (values[index] || '').trim();
                        // Try to parse numbers
                        row[header] = isNaN(value) || value === '' ? value : parseFloat(value) || value;
                    });
                    data.push(row);
                } catch (rowError) {
                    // Skip invalid rows, continue processing
                    console.warn(`Error parsing CSV row ${i}:`, rowError);
                    continue;
                }
            }

            return data;
        } catch (error) {
            console.error('Error parsing CSV:', error);
            return [];
        }
    }

    /**
     * Parse a single CSV line handling quoted values
     */
    parseCSVLine(line) {
        try {
            if (!line || typeof line !== 'string') {
                return [];
            }
            
            const values = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current); // Add last value
            
            return values;
        } catch (error) {
            console.warn('Error parsing CSV line:', error);
            return [];
        }
    }

    /**
     * Aggregate data across all repositories
     */
    async aggregateAllRepositories() {
        const repositories = await this.discoverRepositories();
        const allData = await Promise.all(
            repositories.map(repo => this.loadRepositoryData(repo))
        );

        // Aggregate all data
        const aggregated = {
            total_commits: 0,
            total_developers: new Set(),
            developers: {},
            regional_breakdown: {},
            technology_usage: {},
            vulnerabilities: {
                Total_vulnerability_count: 0,
                Critical_severity_count: 0,
                High_severity_count: 0,
                Medium_severity_count: 0,
                Low_severity_count: 0
            }
        };

        allData.forEach(data => {
            if (!data) return;

            // Aggregate commits
            aggregated.total_commits += data.commits?.total_commits || 0;

            // Aggregate developers
            if (data.developers?.developers) {
                Object.entries(data.developers.developers).forEach(([email, dev]) => {
                    if (!aggregated.developers[email]) {
                        aggregated.developers[email] = {
                            ...dev,
                            repositories: []
                        };
                        aggregated.total_developers.add(email);
                    }
                    
                    // Merge repositories
                    if (dev.repositories) {
                        dev.repositories.forEach(repo => {
                            if (!aggregated.developers[email].repositories.includes(repo)) {
                                aggregated.developers[email].repositories.push(repo);
                            }
                        });
                    }

                    // Merge commit counts
                    aggregated.developers[email].total_commits = 
                        (aggregated.developers[email].total_commits || 0) + (dev.total_commits || 0);
                });
            }

            // Aggregate regional data
            if (data.regional?.regional_breakdown) {
                Object.entries(data.regional.regional_breakdown).forEach(([country, region]) => {
                    if (!aggregated.regional_breakdown[country]) {
                        aggregated.regional_breakdown[country] = {
                            commits: 0,
                            developers_count: 0,
                            developers: [],
                            repositories: []
                        };
                    }
                    
                    aggregated.regional_breakdown[country].commits += region.commits || 0;
                    aggregated.regional_breakdown[country].developers_count = Math.max(
                        aggregated.regional_breakdown[country].developers_count,
                        region.developers_count || 0
                    );
                    
                    // Merge developers
                    if (region.developers) {
                        region.developers.forEach(email => {
                            if (!aggregated.regional_breakdown[country].developers.includes(email)) {
                                aggregated.regional_breakdown[country].developers.push(email);
                            }
                        });
                    }

                    // Merge repositories
                    if (region.repositories) {
                        region.repositories.forEach(repo => {
                            if (!aggregated.regional_breakdown[country].repositories.includes(repo)) {
                                aggregated.regional_breakdown[country].repositories.push(repo);
                            }
                        });
                    }
                });
            }

            // Aggregate technology
            if (data.technology?.overall_technology_usage) {
                Object.entries(data.technology.overall_technology_usage).forEach(([tech, count]) => {
                    aggregated.technology_usage[tech] = (aggregated.technology_usage[tech] || 0) + count;
                });
            }

            // Aggregate vulnerabilities
            if (data.vulnerabilities) {
                aggregated.vulnerabilities.Total_vulnerability_count += 
                    data.vulnerabilities.Total_vulnerability_count || 0;
                aggregated.vulnerabilities.Critical_severity_count += 
                    data.vulnerabilities.Critical_severity_count || 0;
                aggregated.vulnerabilities.High_severity_count += 
                    data.vulnerabilities.High_severity_count || 0;
                aggregated.vulnerabilities.Medium_severity_count += 
                    data.vulnerabilities.Medium_severity_count || 0;
                aggregated.vulnerabilities.Low_severity_count += 
                    data.vulnerabilities.Low_severity_count || 0;
            }
        });

        return {
            developer_contributions: {
                total_developers: aggregated.total_developers.size,
                total_commits: aggregated.total_commits,
                developers: aggregated.developers
            },
            regional_analysis: {
                total_regions: Object.keys(aggregated.regional_breakdown).length,
                regional_breakdown: aggregated.regional_breakdown,
                regional_ranking: Object.entries(aggregated.regional_breakdown)
                    .map(([country, data]) => ({
                        country: country,
                        commits: data.commits,
                        developers_count: data.developers_count
                    }))
                    .sort((a, b) => b.commits - a.commits)
            },
            technology_stack: {
                overall_technology_usage: aggregated.technology_usage,
                technology_by_category: this.categorizeAllTechnologies(aggregated.technology_usage)
            },
            overall_summary: {
                total_commits: aggregated.total_commits,
                total_developers: aggregated.total_developers.size,
                total_regions: Object.keys(aggregated.regional_breakdown).length,
                tech_stack_diversity: Object.keys(aggregated.technology_usage).length
            },
            vulnerability_data: aggregated.vulnerabilities
        };
    }

    // Helper methods

    extractCountry(ranking) {
        // Try to extract country from available data
        // This would need to be enhanced based on actual data structure
        return 'Unknown';
    }

    extractWorkTypes(ranking) {
        // Extract work types if available in ranking data
        return {
            feature: 0,
            bug_fix: 0,
            maintenance: 0
        };
    }

    categorizeTechnology(name) {
        const lower = name.toLowerCase();
        
        // Languages
        if (['c#', 'csharp', 'javascript', 'typescript', 'python', 'java', 'ruby', 
             'go', 'rust', 'cpp', 'c++', 'c', 'sql', 'html', 'css', 'php'].includes(lower)) {
            return 'languages';
        }
        
        // Frameworks
        if (['.net', 'asp.net', 'razor', 'react', 'vue', 'angular', 'rails', 
             'django', 'spring', 'express'].includes(lower)) {
            return 'frameworks';
        }
        
        // Databases
        if (['mysql', 'postgresql', 'mongodb', 'redis', 'sqlite', 'oracle'].includes(lower)) {
            return 'databases';
        }
        
        // Security
        if (['ssl', 'https', 'oauth', 'saml', 'ldap', 'jwt', 'authentication', 
             'authorization', 'encryption'].includes(lower)) {
            return 'security';
        }
        
        // Networking
        if (['http', 'rest', 'api', 'soap', 'websocket', 'tcp', 'udp', 'grpc'].includes(lower)) {
            return 'networking';
        }
        
        // Platforms
        if (['azure', 'aws', 'gcp', 'docker', 'kubernetes', 'windows', 'linux', 
             'macos', 'ios', 'android'].includes(lower)) {
            return 'platforms';
        }
        
        // Tools
        return 'tools';
    }

    categorizeAllTechnologies(techUsage) {
        const categories = {
            languages: {},
            frameworks: {},
            databases: {},
            security: {},
            networking: {},
            platforms: {},
            tools: {}
        };

        Object.entries(techUsage).forEach(([tech, count]) => {
            const category = this.categorizeTechnology(tech);
            if (categories[category]) {
                categories[category][tech] = count;
            }
        });

        return categories;
    }
}

// Initialize global adapter instance
window.analysisDataAdapter = new AnalysisDataAdapter();
