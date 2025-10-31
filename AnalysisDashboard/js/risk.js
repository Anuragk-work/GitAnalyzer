class RiskDashboard {
    constructor() {
        this.technologyData = null;
        this.overallData = null;
        this.developerData = null;
        this.vulnerabilityData = null;
        this.repositoryVulnerabilityData = null;
        this.codeAnalysisData = null;
        this.charts = new Map();
        this.utils = window.analyticsUtils;
    }

    truncatePath(path) {
        if (!path) return '';
        if (path.length > 50) {
            const parts = path.split('/');
            if (parts.length > 2) {
                return '.../' + parts.slice(-2).join('/');
            }
            return path.substring(0, 47) + '...';
        }
        return path;
    }

    async initialize() {
        try {
            await this.loadRiskData();
            await this.initializeCharts();
            
            // Show dashboard content first
            const loadingIndicator = document.getElementById('loadingIndicator');
            const dashboardContent = document.getElementById('dashboardContent');
            
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (dashboardContent) dashboardContent.classList.remove('hidden');
            
            // Wait a bit for DOM to fully render before updating metrics
            setTimeout(async () => {
                await this.updateMetrics();
            }, 100);
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Update timestamp
            if (this.utils && this.utils.updateTimestamp) {
                this.utils.updateTimestamp();
            }
            
        } catch (error) {
            console.error('Error initializing risk dashboard:', error);
            this.showError('Failed to load risk analytics data');
        }
    }

    async loadRiskData() {
        try {
            // Load multiple data sources for comprehensive risk analysis
            this.technologyData = await this.utils.loadTechnologyStack();
            this.overallData = await this.utils.loadOverallSummary();
            this.developerData = await this.utils.loadDeveloperContributions();
            
            // Load complexity data for technical debt calculations
            this.complexityData = await this.utils.loadComplexityData();
            
            // Load vulnerability data for risk calculations
            await this.loadVulnerabilityData();
            await this.loadRepositoryVulnerabilityData();
            
            // Load code analysis data for churn and effort metrics
            this.codeAnalysisData = await this.utils.loadCodeAnalysisData();
            
            console.log('Loaded risk data:', { 
                tech: this.technologyData, 
                overall: this.overallData,
                developers: this.developerData,
                complexity: !!this.complexityData,
                vulnerabilities: this.vulnerabilityData,
                repoVulns: this.repositoryVulnerabilityData,
                codeAnalysis: !!this.codeAnalysisData
            });
        } catch (error) {
            console.error('Error loading risk data:', error);
            throw error;
        }
    }

    async loadVulnerabilityData() {
        try {
            const response = await fetch('final-fpipe/vulnerability-data/overall_vuln_count.json');
            if (response.ok) {
                this.vulnerabilityData = await response.json();
            } else {
                throw new Error(`Failed to load vulnerability data: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading vulnerability data:', error);
            this.vulnerabilityData = {
                Total_vulnerability_count: 0,
                Critical_severity_count: 0,
                High_severity_count: 0,
                Medium_severity_count: 0,
                Low_severity_count: 0
            };
        }
    }

    async loadRepositoryVulnerabilityData() {
        try {
            // Get repositories dynamically - NO HARDCODED REPOSITORIES
            const repositories = this.utils?.repositories || await this.utils?.adapter?.discoverRepositories() || [];
            
            if (repositories.length === 0) {
                console.warn('No repositories found for vulnerability data');
                this.repositoryVulnerabilityData = {};
                return;
            }
            
            this.repositoryVulnerabilityData = {};
            
            for (const repo of repositories) {
                try {
                    // Use AnalysisData adapter to load vulnerability data
                    const repoData = await this.utils.adapter.loadRepositoryData(repo);
                    if (repoData && repoData.vulnerabilities) {
                        this.repositoryVulnerabilityData[repo] = repoData.vulnerabilities;
                    } else {
                        // Set empty data if no vulnerabilities found
                        this.repositoryVulnerabilityData[repo] = {
                            Total_vulnerability_count: 0,
                            Critical_severity_count: 0,
                            High_severity_count: 0,
                            Medium_severity_count: 0,
                            Low_severity_count: 0
                        };
                    }
                } catch (repoError) {
                    console.warn(`Error loading ${repo} vulnerability data:`, repoError);
                    this.repositoryVulnerabilityData[repo] = {
                        Total_vulnerability_count: 0,
                        Critical_severity_count: 0,
                        High_severity_count: 0,
                        Medium_severity_count: 0,
                        Low_severity_count: 0
                    };
                }
            }
            
            console.log(`✅ Loaded vulnerability data for ${repositories.length} repositories`);
        } catch (error) {
            console.error('Error loading repository vulnerability data:', error);
            this.repositoryVulnerabilityData = {};
        }
    }

    async initializeCharts() {
        const chartPromises = [
            this.createRepositoryRiskHeatmap(),
            this.createTechnicalDebtChart(),
            this.createKnowledgeRiskChart(),
            this.createEntityChurnChart(),
            this.createEntityEffortChart()
        ];

        await Promise.allSettled(chartPromises);
        console.log('Risk charts initialization completed');
    }

    async createRepositoryRiskHeatmap() {
        const container = document.getElementById('repositoryRiskHeatmap');
        if (!container || !this.repositoryVulnerabilityData) return;

        try {
            // Get repositories dynamically - NO HARDCODED REPOSITORIES
            const repositories = this.utils?.repositories || await this.utils?.adapter?.discoverRepositories() || [];
            
            if (repositories.length === 0) {
                container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No repository data available</div>';
                return;
            }
            
            // Create series data for heatmap
            const series = [{
                name: 'Risk Level',
                data: repositories.map(repo => {
                    const vulnData = this.repositoryVulnerabilityData[repo] || {};
                    const totalVulns = vulnData.Total_vulnerability_count || 0;
                    const criticalVulns = vulnData.Critical_severity_count || 0;
                    const highVulns = vulnData.High_severity_count || 0;
                    
                    // Calculate risk score (0-100)
                    const riskScore = (criticalVulns * 10) + (highVulns * 5) + (totalVulns * 1);
                    return {
                        x: repo,
                        y: Math.min(100, riskScore),
                        meta: {
                            total: totalVulns,
                            critical: criticalVulns,
                            high: highVulns
                        }
                    };
                })
            }];

            const options = {
                series: series,
                chart: {
                    type: 'treemap',
                    height: '100%',
                    toolbar: {
                        show: false
                    }
                },
                plotOptions: {
                    treemap: {
                        enableShades: true,
                        shadeIntensity: 0.5,
                        reverseNegativeShade: true,
                        colorScale: {
                            ranges: [
                                { from: 0, to: 10, color: '#00A100' },
                                { from: 11, to: 30, color: '#128FD9' },
                                { from: 31, to: 60, color: '#FFB200' },
                                { from: 61, to: 100, color: '#FF0000' }
                            ]
                        }
                    }
                },
                dataLabels: {
                    enabled: true,
                    style: {
                        fontSize: '12px',
                        fontWeight: 'bold'
                    },
                    formatter: function(text, op) {
                        return [text, `Risk: ${op.value}`];
                    }
                },
                tooltip: {
                    y: {
                        formatter: function(value, { w, seriesIndex, dataPointIndex }) {
                            const meta = w.config.series[seriesIndex].data[dataPointIndex].meta;
                            return `Risk Score: ${value}<br/>Total Vulnerabilities: ${meta.total}<br/>Critical: ${meta.critical}<br/>High: ${meta.high}`;
                        }
                    }
                }
            };

            const chart = new ApexCharts(container, options);
            await chart.render();
            this.charts.set('repositoryRiskHeatmap', chart);

        } catch (error) {
            console.error('Error creating repository risk heatmap:', error);
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error loading risk heatmap</div>';
        }
    }

    async createTechnicalDebtChart() {
        const container = document.getElementById('technicalDebtChart');
        if (!container || !this.repositoryVulnerabilityData) return;

        try {
            // Get repositories dynamically - NO HARDCODED REPOSITORIES
            const repositories = this.utils?.repositories || await this.utils?.adapter?.discoverRepositories() || [];
            
            if (repositories.length === 0) {
                container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No repository data available</div>';
                return;
            }
            
            // Calculate technical debt based on vulnerability counts and complexity
            const debtData = repositories.map(repo => {
                const vulnData = this.repositoryVulnerabilityData[repo] || {};
                const totalVulns = vulnData.Total_vulnerability_count || 0;
                const criticalVulns = vulnData.Critical_severity_count || 0;
                const mediumVulns = vulnData.Medium_severity_count || 0;
                
                // Technical debt score based on vulnerability density
                return (criticalVulns * 5) + (totalVulns * 2) + (mediumVulns * 1);
            });

            const options = {
                series: [{
                    name: 'Technical Debt Score',
                    data: debtData
                }],
                chart: {
                    type: 'bar',
                    height: '100%',
                    toolbar: {
                        show: false
                    }
                },
                plotOptions: {
                    bar: {
                        borderRadius: 4,
                        horizontal: false,
                        columnWidth: '60%',
                    }
                },
                dataLabels: {
                    enabled: false
                },
                xaxis: {
                    categories: repositories,
                    labels: {
                        style: {
                            fontSize: '11px'
                        },
                        rotate: -45
                    }
                },
                yaxis: {
                    title: {
                        text: 'Technical Debt Score'
                    }
                },
                colors: ['#EA580C'],
                fill: {
                    type: 'gradient',
                    gradient: {
                        shade: 'light',
                        type: 'vertical',
                        shadeIntensity: 0.25,
                        gradientToColors: ['#FB923C'],
                        inverseColors: false,
                        opacityFrom: 0.85,
                        opacityTo: 0.85,
                        stops: [50, 0, 100]
                    }
                }
            };

            const chart = new ApexCharts(container, options);
            await chart.render();
            this.charts.set('technicalDebtChart', chart);

        } catch (error) {
            console.error('Error creating technical debt chart:', error);
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error loading technical debt chart</div>';
        }
    }

    async createKnowledgeRiskChart() {
        const container = document.getElementById('knowledgeRiskChart');
        if (!container || !this.developerData) return;

        try {
            // Calculate from actual developer data
            let totalDevelopers = 0;
            let activeDevelopers = 0;
            
            if (this.developerData && this.developerData.developers) {
                const developers = Object.values(this.developerData.developers);
                totalDevelopers = developers.length;
                
                // Calculate active developers (those with recent commits)
                const currentDate = new Date();
                const sixMonthsAgo = new Date(currentDate.setMonth(currentDate.getMonth() - 6));
                
                activeDevelopers = developers.filter(dev => {
                    if (dev.activity_period && dev.activity_period.last_commit) {
                        const lastCommit = new Date(dev.activity_period.last_commit);
                        return lastCommit >= sixMonthsAgo;
                    }
                    // If no last_commit date, consider active if they have commits
                    return (dev.total_commits || dev.commits || 0) > 0;
                }).length;
            } else if (this.overallData && this.overallData.combined_metrics) {
                totalDevelopers = this.overallData.combined_metrics.active_contributors || 0;
                activeDevelopers = totalDevelopers; // Use as active if no breakdown
            }
            
            if (totalDevelopers === 0) {
                container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No developer data available</div>';
                return;
            }
            
            const inactiveDevelopers = totalDevelopers - activeDevelopers;
            const knowledgeAtRisk = Math.round((inactiveDevelopers / totalDevelopers) * 100);
            const activeKnowledge = 100 - knowledgeAtRisk;

            const options = {
                series: [knowledgeAtRisk, activeKnowledge],
                chart: {
                    type: 'pie',
                    height: '100%'
                },
                labels: ['Knowledge at Risk', 'Active Knowledge'],
                colors: ['#DC2626', '#059669'],
                legend: {
                    position: 'bottom',
                    fontSize: '14px'
                },
                dataLabels: {
                    enabled: true,
                    formatter: function (val) {
                        return Math.round(val) + '%';
                    }
                },
                tooltip: {
                    y: {
                        formatter: function(value, { seriesIndex }) {
                            const developers = seriesIndex === 0 ? inactiveDevelopers : activeDevelopers;
                            return `${value.toFixed(1)}% (${developers} developers)`;
                        }
                    }
                }
            };

            const chart = new ApexCharts(container, options);
            await chart.render();
            this.charts.set('knowledgeRiskChart', chart);

        } catch (error) {
            console.error('Error creating knowledge risk chart:', error);
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error loading knowledge risk chart</div>';
        }
    }

    async updateMetrics() {
        if (!this.overallData || !this.vulnerabilityData) {
            console.warn('Missing data for risk metrics');
            return;
        }

        try {
            // Helper function to safely update element
            const safeUpdateElement = (elementId, value) => {
                const element = document.getElementById(elementId);
                if (element) {
                    element.textContent = value;
                } else {
                    console.warn(`Element with ID '${elementId}' not found`);
                }
            };

            // Knowledge Risk - Calculate from actual developer data
            let totalDevelopers = 0;
            let activeDevelopers = 0;
            
            // Try multiple data sources for developer counts
            if (this.developerData && this.developerData.developers) {
                const developers = Object.values(this.developerData.developers);
                totalDevelopers = developers.length;
                // Calculate active developers (those with recent commits)
                const currentDate = new Date();
                const sixMonthsAgo = new Date(currentDate.setMonth(currentDate.getMonth() - 6));
                
                activeDevelopers = developers.filter(dev => {
                    if (dev.activity_period && dev.activity_period.last_commit) {
                        const lastCommit = new Date(dev.activity_period.last_commit);
                        return lastCommit >= sixMonthsAgo;
                    }
                    // If no last_commit date, consider active if they have commits
                    return (dev.total_commits || dev.commits || 0) > 0;
                }).length;
            } else if (this.overallData.combined_metrics) {
                totalDevelopers = this.overallData.combined_metrics.active_contributors || 0;
                activeDevelopers = totalDevelopers; // Use as active if no breakdown
            } else if (this.developerData && this.developerData.total_developers) {
                totalDevelopers = this.developerData.total_developers;
                activeDevelopers = totalDevelopers; // Assume all are active if no breakdown
            }
            
            const knowledgeRiskScore = totalDevelopers > 0 
                ? Math.round(((totalDevelopers - activeDevelopers) / totalDevelopers) * 100)
                : 0;
            safeUpdateElement('knowledgeRisk', `${knowledgeRiskScore}%`);

            // Technical Debt Score - Calculate from complexity data
            let complexityPercentage = 0;
            
            if (this.complexityData && this.complexityData.analysis && this.complexityData.analysis.summary) {
                const summary = this.complexityData.analysis.summary;
                const totalFunctions = summary.total_functions || 0;
                const dist = summary.complexity_distribution || {};
                const highComplexity = (dist.high || 0) + (dist.very_high || 0);
                
                if (totalFunctions > 0) {
                    complexityPercentage = (highComplexity / totalFunctions) * 100;
                }
            }
            
            safeUpdateElement('technicalDebtScore', complexityPercentage > 0 
                ? `${complexityPercentage.toFixed(1)}%`
                : '--');

            // Legacy Risk - Calculate from actual first commit date
            const currentYear = new Date().getFullYear();
            let firstCommitYear = null;
            
            // Try to get first commit date from commit data
            if (this.codeAnalysisData && this.codeAnalysisData.revisions && this.codeAnalysisData.revisions.length > 0) {
                // Find earliest commit date from revisions
                const dates = this.codeAnalysisData.revisions
                    .map(r => r.date || r.commit_date)
                    .filter(d => d)
                    .map(d => new Date(d).getFullYear())
                    .filter(y => !isNaN(y));
                
                if (dates.length > 0) {
                    firstCommitYear = Math.min(...dates);
                }
            }
            
            // Fallback to overall data
            if (!firstCommitYear && this.overallData) {
                const firstCommitDateStr = this.overallData.first_commit_date || 
                                          this.overallData.combined_metrics?.first_commit_date ||
                                          this.overallData.metadata?.first_commit_date;
                
                if (firstCommitDateStr) {
                    firstCommitYear = new Date(firstCommitDateStr).getFullYear();
                }
            }
            
            // If still no date, try to extract from commit data
            if (!firstCommitYear && this.developerData && this.developerData.developers) {
                const developers = Object.values(this.developerData.developers);
                const earliestDates = developers
                    .map(dev => dev.activity_period?.first_commit)
                    .filter(d => d)
                    .map(d => new Date(d).getFullYear())
                    .filter(y => !isNaN(y));
                
                if (earliestDates.length > 0) {
                    firstCommitYear = Math.min(...earliestDates);
                }
            }
            
            let legacyRiskScore = 0;
            if (firstCommitYear && !isNaN(firstCommitYear)) {
                const codebaseAge = currentYear - firstCommitYear;
                legacyRiskScore = Math.min(100, (codebaseAge / 30) * 100); // 30 years = 100% legacy risk
            }
            
            safeUpdateElement('legacyRisk', legacyRiskScore > 0 
                ? `${Math.round(legacyRiskScore)}%`
                : '--');

            // Platform Diversity - Calculate from technology stack data
            let totalTechnologies = 0;
            
            if (this.technologyData && this.technologyData.overall_technology_usage) {
                totalTechnologies = Object.keys(this.technologyData.overall_technology_usage).length;
            } else if (this.overallData && this.overallData.combined_metrics) {
                totalTechnologies = this.overallData.combined_metrics.tech_stack_diversity || 0;
            }
            
            safeUpdateElement('platformDiversity', totalTechnologies > 0 
                ? totalTechnologies.toString()
                : '--');

            // Maintenance Burden - Calculate from technology data (sum of lines)
            let linesOfCode = 0;
            
            if (this.technologyData && this.technologyData.technology_details) {
                // Sum all lines from technology details
                Object.values(this.technologyData.technology_details).forEach(tech => {
                    linesOfCode += tech.lines || 0;
                });
            } else if (this.complexityData && this.complexityData.analysis && this.complexityData.analysis.summary) {
                // Fallback to NLOC from complexity data
                linesOfCode = this.complexityData.analysis.summary.total_nloc || 0;
            }
            
            const maintenanceBurden = linesOfCode > 0 
                ? (linesOfCode >= 1000000 
                    ? `${(linesOfCode / 1000000).toFixed(1)}M`
                    : `${(linesOfCode / 1000).toFixed(1)}K`)
                : '--';
            safeUpdateElement('maintenanceBurden', maintenanceBurden);

            // Repository Risk - Overall vulnerability concentration
            const totalVulns = this.vulnerabilityData.Total_vulnerability_count || 0;
            const criticalVulns = this.vulnerabilityData.Critical_severity_count || 0;
            const highVulns = this.vulnerabilityData.High_severity_count || 0;
            const criticalHighVulns = criticalVulns + highVulns;
            const repositoryRiskScore = totalVulns > 0 
                ? Math.round((criticalHighVulns / totalVulns) * 100)
                : 0;
            safeUpdateElement('repositoryRisk', `${repositoryRiskScore}%`);

            console.log('Updated risk metrics with real data:', {
                knowledgeRisk: `${knowledgeRiskScore}%`,
                technicalDebt: complexityPercentage > 0 ? `${complexityPercentage.toFixed(1)}%` : 'N/A',
                legacyRisk: legacyRiskScore > 0 ? `${Math.round(legacyRiskScore)}%` : 'N/A',
                platformDiversity: totalTechnologies > 0 ? totalTechnologies : 'N/A',
                maintenanceBurden,
                repositoryRisk: `${repositoryRiskScore}%`,
                firstCommitYear: firstCommitYear || 'Not found'
            });

            // Update additional components
            this.updateHighRiskRepositories();
            await this.updateKnowledgeTransferRisks();
            this.updateTechnicalDebtTable();

        } catch (error) {
            console.error('Error updating risk metrics:', error);
            console.error('Error stack:', error.stack);
        }
    }

    updateHighRiskRepositories() {
        const container = document.getElementById('highRiskRepositories');
        if (!container || !this.repositoryVulnerabilityData) {
            console.warn('High risk repositories container not found or no vulnerability data available');
            return;
        }

        // Sort repositories by risk level
        const repositories = Object.entries(this.repositoryVulnerabilityData)
            .map(([repo, data]) => ({
                name: repo,
                totalVulns: data.Total_vulnerability_count || 0,
                criticalVulns: data.Critical_severity_count || 0,
                highVulns: data.High_severity_count || 0,
                riskScore: (data.Critical_severity_count || 0) * 10 + (data.High_severity_count || 0) * 5 + (data.Total_vulnerability_count || 0)
            }))
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 4);

        let html = '';
        repositories.forEach(repo => {
            const severity = repo.criticalVulns > 0 ? 'Critical' : 
                           repo.highVulns > 5 ? 'High' : 
                           repo.totalVulns > 20 ? 'Medium' : 'Low';
            
            const severityClass = severity.toLowerCase() === 'critical' ? 'risk-critical' : 
                                 severity.toLowerCase() === 'high' ? 'risk-high' : 
                                 severity.toLowerCase() === 'medium' ? 'risk-medium' : 'risk-low';
            
            const bgClass = severity === 'Critical' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' :
                           severity === 'High' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700' :
                           severity === 'Medium' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' :
                                                  'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700';
            
            const iconClass = severity === 'Critical' ? 'fas fa-exclamation-triangle text-red-600' :
                             severity === 'High' ? 'fas fa-exclamation-circle text-orange-600' :
                             severity === 'Medium' ? 'fas fa-info-circle text-yellow-600' :
                                                    'fas fa-check-circle text-green-600';

            html += `
                <div class="flex items-center justify-between p-3 ${bgClass} rounded-lg border">
                    <div class="flex items-center">
                        <i class="${iconClass} mr-3"></i>
                        <div>
                            <h4 class="font-semibold text-gray-900 dark:text-gray-300">${repo.name}</h4>
                            <p class="text-sm text-gray-700 dark:text-gray-400">${repo.totalVulns} vulnerabilities (${repo.criticalVulns} critical, ${repo.highVulns} high)</p>
                        </div>
                    </div>
                    <span class="risk-badge ${severityClass}">${severity}</span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    async updateKnowledgeTransferRisks() {
        const container = document.getElementById('knowledgeTransferRisks');
        if (!container) {
            console.warn('Knowledge transfer risks container not found');
            return;
        }

        // Calculate knowledge transfer risks from actual data
        let totalDevelopers = 0;
        let activeDevelopers = 0;
        let totalCommits = 0;
        let totalRepos = 0;
        
        // Get developer counts
        if (this.developerData && this.developerData.developers) {
            const developers = Object.values(this.developerData.developers);
            totalDevelopers = developers.length;
            
            const currentDate = new Date();
            const sixMonthsAgo = new Date(currentDate.setMonth(currentDate.getMonth() - 6));
            
            activeDevelopers = developers.filter(dev => {
                if (dev.activity_period && dev.activity_period.last_commit) {
                    const lastCommit = new Date(dev.activity_period.last_commit);
                    return lastCommit >= sixMonthsAgo;
                }
                return (dev.total_commits || dev.commits || 0) > 0;
            }).length;
        } else if (this.overallData && this.overallData.combined_metrics) {
            totalDevelopers = this.overallData.combined_metrics.active_contributors || 0;
            activeDevelopers = totalDevelopers;
        }
        
        // Get commit counts
        if (this.overallData && this.overallData.combined_metrics) {
            totalCommits = this.overallData.combined_metrics.total_commits || 0;
        } else if (this.developerData) {
            totalCommits = this.developerData.total_commits || 0;
        }
        
        // Get repository count from discovered repositories
        if (this.utils && this.utils.repositories) {
            totalRepos = this.utils.repositories.length;
        } else if (this.utils && this.utils.adapter) {
            const repos = await this.utils.adapter.discoverRepositories();
            totalRepos = repos.length;
        }

        // Calculate codebase age from actual commit dates
        let codebaseAge = 0;
        if (this.codeAnalysisData && this.codeAnalysisData.revisions && this.codeAnalysisData.revisions.length > 0) {
            const dates = this.codeAnalysisData.revisions
                .map(r => r.date || r.commit_date)
                .filter(d => d)
                .map(d => new Date(d).getFullYear())
                .filter(y => !isNaN(y));
            
            if (dates.length > 0) {
                const firstYear = Math.min(...dates);
                const currentYear = new Date().getFullYear();
                codebaseAge = currentYear - firstYear;
            }
        } else if (this.developerData && this.developerData.developers) {
            const developers = Object.values(this.developerData.developers);
            const earliestDates = developers
                .map(dev => dev.activity_period?.first_commit)
                .filter(d => d)
                .map(d => new Date(d).getFullYear())
                .filter(y => !isNaN(y));
            
            if (earliestDates.length > 0) {
                const firstYear = Math.min(...earliestDates);
                const currentYear = new Date().getFullYear();
                codebaseAge = currentYear - firstYear;
            }
        }

        const risks = [
            {
                title: 'Developer Concentration',
                description: `${activeDevelopers} active developers maintaining ${totalRepos} repositories`,
                severity: activeDevelopers < totalRepos ? 'High' : 'Medium',
                riskClass: activeDevelopers < totalRepos ? 'risk-high' : 'risk-medium',
                bgClass: activeDevelopers < totalRepos 
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
                iconClass: 'fas fa-users text-orange-600'
            },
            {
                title: 'Historical Knowledge Gap',
                description: `${totalDevelopers - activeDevelopers} inactive developers with historical context`,
                severity: (totalDevelopers - activeDevelopers) > totalDevelopers * 0.5 ? 'Critical' : 'High',
                riskClass: (totalDevelopers - activeDevelopers) > totalDevelopers * 0.5 ? 'risk-critical' : 'risk-high',
                bgClass: (totalDevelopers - activeDevelopers) > totalDevelopers * 0.5
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                    : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700',
                iconClass: 'fas fa-history text-red-600'
            }
        ];
        
        // Add legacy risk item only if we have codebase age
        if (codebaseAge > 0) {
            risks.push({
                title: 'Legacy System Expertise',
                description: `${codebaseAge}-year codebase requires specialized legacy knowledge`,
                severity: codebaseAge > 15 ? 'High' : 'Medium',
                riskClass: codebaseAge > 15 ? 'risk-high' : 'risk-medium',
                bgClass: codebaseAge > 15
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
                iconClass: 'fas fa-clock text-orange-600'
            });
        }

        let html = '';
        risks.forEach(risk => {
            html += `
                <div class="flex items-center justify-between p-3 ${risk.bgClass} rounded-lg border">
                    <div class="flex items-center">
                        <i class="${risk.iconClass} mr-3"></i>
                        <div>
                            <h4 class="font-semibold text-gray-900 dark:text-gray-300">${risk.title}</h4>
                            <p class="text-sm text-gray-700 dark:text-gray-400">${risk.description}</p>
                        </div>
                    </div>
                    <span class="risk-badge ${risk.riskClass}">${risk.severity}</span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateTechnicalDebtTable() {
        const container = document.getElementById('technicalDebtTable');
        if (!container || !this.repositoryVulnerabilityData) {
            console.warn('Technical debt table container not found or no vulnerability data available');
            return;
        }

        // Create technical debt analysis table with real data
        const repositories = Object.entries(this.repositoryVulnerabilityData)
            .map(([repo, data]) => ({
                repository: repo,
                totalVulns: data.Total_vulnerability_count || 0,
                criticalVulns: data.Critical_severity_count || 0,
                highVulns: data.High_severity_count || 0,
                mediumVulns: data.Medium_severity_count || 0,
                debtScore: (data.Critical_severity_count || 0) * 10 + (data.High_severity_count || 0) * 5 + (data.Medium_severity_count || 0) * 2
            }))
            .sort((a, b) => b.debtScore - a.debtScore);

        let html = `
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Repository</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Vulnerabilities</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Critical</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">High</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Medium</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Debt Score</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Risk Level</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
        `;

        repositories.forEach(repo => {
            const riskLevel = repo.debtScore > 50 ? 'Critical' : 
                             repo.debtScore > 20 ? 'High' : 
                             repo.debtScore > 5 ? 'Medium' : 'Low';
            
            const riskBadge = riskLevel === 'Critical' ? 'risk-critical' :
                             riskLevel === 'High' ? 'risk-high' :
                             riskLevel === 'Medium' ? 'risk-medium' : 'risk-low';

            html += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${repo.repository}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${repo.totalVulns}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-red-600">${repo.criticalVulns}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-orange-600">${repo.highVulns}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">${repo.mediumVulns}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">${repo.debtScore}</td>
                    <td class="px-6 py-4 whitespace-nowrap"><span class="risk-badge ${riskBadge}">${riskLevel}</span></td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    setupEventListeners() {
        // Theme toggle
        this.utils.setupThemeToggle();

        // Sidebar toggle
        this.utils.setupSidebarToggle();

        // Refresh data button
        document.getElementById('refreshData')?.addEventListener('click', () => {
            this.initialize();
        });
    }

    showError(message) {
        document.getElementById('loadingIndicator').innerHTML = `
            <div class="flex items-center justify-center py-12">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <p class="text-gray-600 dark:text-gray-400">${message}</p>
                </div>
            </div>
        `;
    }

    /**
     * Create entity churn visualization
     */
    async createEntityChurnChart() {
        if (!this.codeAnalysisData?.entity_churn) {
            console.log('No entity churn data available');
            return;
        }

        const container = document.getElementById('entityChurnSection');
        if (!container) {
            // Create section if it doesn't exist
            const grid = document.querySelector('#dashboardContent .grid');
            if (grid) {
                const newSection = document.createElement('div');
                newSection.className = 'dashboard-card col-span-full';
                newSection.id = 'entityChurnSection';
                grid.appendChild(newSection);
            } else {
                return;
            }
        }

        const churnData = this.codeAnalysisData.entity_churn || [];
        const topChurn = churnData
            .sort((a, b) => (b.added + b.deleted || 0) - (a.added + a.deleted || 0))
            .slice(0, 20);

        const totalChurn = churnData.reduce((sum, item) => sum + (item.added || 0) + (item.deleted || 0), 0);
        const avgChurn = churnData.length > 0 ? Math.round(totalChurn / churnData.length) : 0;
        const highChurnCount = churnData.filter(item => (item.added || 0) + (item.deleted || 0) > 1000).length;

        container.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                <i class="fas fa-sync-alt mr-2 text-orange-500"></i>
                Entity Churn Analysis
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                    <p class="text-sm text-gray-600 dark:text-gray-400">Total Entities</p>
                    <p class="text-2xl font-bold text-orange-600 dark:text-orange-400">${churnData.length}</p>
                </div>
                <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                    <p class="text-sm text-gray-600 dark:text-gray-400">Avg Churn per Entity</p>
                    <p class="text-2xl font-bold text-red-600 dark:text-red-400">${avgChurn.toLocaleString()}</p>
                </div>
                <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <p class="text-sm text-gray-600 dark:text-gray-400">High Churn Entities</p>
                    <p class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">${highChurnCount}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">&gt; 1000 lines changed</p>
                </div>
            </div>
            <div class="chart-container">
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Entities by Churn (Lines Added + Deleted)</h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                        <thead class="bg-gray-100 dark:bg-gray-700 sticky top-0">
                            <tr>
                                <th class="px-3 py-2 text-left">Entity</th>
                                <th class="px-3 py-2 text-right">Added</th>
                                <th class="px-3 py-2 text-right">Deleted</th>
                                <th class="px-3 py-2 text-right">Total Churn</th>
                                <th class="px-3 py-2 text-right">Commits</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topChurn.map((item, idx) => {
                                const total = (item.added || 0) + (item.deleted || 0);
                                return `
                                    <tr class="border-b border-gray-200 dark:border-gray-700 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}">
                                        <td class="px-3 py-2 truncate max-w-md" title="${item.entity || ''}">${this.truncatePath(item.entity || '')}</td>
                                        <td class="px-3 py-2 text-right text-green-600 dark:text-green-400">+${(item.added || 0).toLocaleString()}</td>
                                        <td class="px-3 py-2 text-right text-red-600 dark:text-red-400">-${(item.deleted || 0).toLocaleString()}</td>
                                        <td class="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">${total.toLocaleString()}</td>
                                        <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400">${item.commits || 0}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Create entity effort visualization
     */
    async createEntityEffortChart() {
        if (!this.codeAnalysisData?.entity_effort) {
            console.log('No entity effort data available');
            return;
        }

        const container = document.getElementById('entityEffortSection');
        if (!container) {
            const grid = document.querySelector('#dashboardContent .grid');
            if (grid) {
                const newSection = document.createElement('div');
                newSection.className = 'dashboard-card col-span-full';
                newSection.id = 'entityEffortSection';
                grid.appendChild(newSection);
            } else {
                return;
            }
        }

        const effortData = this.codeAnalysisData.entity_effort || [];
        const topEffort = effortData
            .sort((a, b) => (b.effort || 0) - (a.effort || 0))
            .slice(0, 20);

        const totalEffort = effortData.reduce((sum, item) => sum + (item.effort || 0), 0);
        const avgEffort = effortData.length > 0 ? Math.round(totalEffort / effortData.length) : 0;
        const highEffortCount = effortData.filter(item => (item.effort || 0) > 100).length;

        container.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                <i class="fas fa-tasks mr-2 text-blue-500"></i>
                Entity Effort Analysis
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <p class="text-sm text-gray-600 dark:text-gray-400">Total Entities</p>
                    <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">${effortData.length}</p>
                </div>
                <div class="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                    <p class="text-sm text-gray-600 dark:text-gray-400">Avg Effort per Entity</p>
                    <p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">${avgEffort.toLocaleString()}</p>
                </div>
                <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                    <p class="text-sm text-gray-600 dark:text-gray-400">High Effort Entities</p>
                    <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">${highEffortCount}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">&gt; 100 effort score</p>
                </div>
            </div>
            <div class="chart-container">
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Entities by Development Effort</h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                        <thead class="bg-gray-100 dark:bg-gray-700 sticky top-0">
                            <tr>
                                <th class="px-3 py-2 text-left">Entity</th>
                                <th class="px-3 py-2 text-right">Effort</th>
                                <th class="px-3 py-2 text-right">Added</th>
                                <th class="px-3 py-2 text-right">Deleted</th>
                                <th class="px-3 py-2 text-right">Commits</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topEffort.map((item, idx) => `
                                <tr class="border-b border-gray-200 dark:border-gray-700 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}">
                                    <td class="px-3 py-2 truncate max-w-md" title="${item.entity || ''}">${this.truncatePath(item.entity || '')}</td>
                                    <td class="px-3 py-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">${(item.effort || 0).toLocaleString()}</td>
                                    <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400">${(item.added || 0).toLocaleString()}</td>
                                    <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400">${(item.deleted || 0).toLocaleString()}</td>
                                    <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400">${item.commits || 0}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    truncatePath(path) {
        if (!path) return '';
        if (path.length > 50) {
            const parts = path.split('/');
            if (parts.length > 2) {
                return '.../' + parts.slice(-2).join('/');
            }
            return path.substring(0, 47) + '...';
        }
        return path;
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    function initializeDashboard() {
        if (window.analyticsUtils) {
            window.riskDashboard = new RiskDashboard();
            window.riskDashboard.initialize();
        } else {
            setTimeout(initializeDashboard, 50);
        }
    }
    
    initializeDashboard();
});