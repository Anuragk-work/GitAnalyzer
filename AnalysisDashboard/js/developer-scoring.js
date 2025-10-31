/**
 * Developer Scoring Panel
 * Displays developer rankings and scoring metrics from developer_rankings.json
 */

class DeveloperScoring {
    constructor() {
        this.isInitialized = false;
        this.rankingsData = null;
        this.selectedRepository = null;
        this.currentView = 'cards'; // 'cards' or 'table'
        this.sortBy = 'rank'; // 'rank', 'score', 'commits', 'name'
        this.sortOrder = 'asc'; // 'asc' or 'desc'
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing Developer Scoring Panel...');
        
        try {
            await this.loadRankingsData();
            await this.renderPanel();
            
            this.isInitialized = true;
            console.log('Developer Scoring Panel initialized successfully');
            
        } catch (error) {
            console.error('Error initializing developer scoring panel:', error);
        }
    }

    async loadRankingsData() {
        try {
            // Discover repositories
            const repositories = await this.discoverRepositories();
            
            // Load rankings for all repositories
            const rankingsPromises = repositories.map(async (repo) => {
                try {
                    const response = await fetch(`AnalysisData/${repo}/developer_rankings.json`);
                    if (!response.ok) return null;
                    const data = await response.json();
                    return { repository: repo, data: data };
                } catch (error) {
                    console.warn(`Failed to load rankings for ${repo}:`, error);
                    return null;
                }
            });

            const results = await Promise.allSettled(rankingsPromises);
            this.rankingsData = results
                .filter(r => r.status === 'fulfilled' && r.value !== null)
                .map(r => r.value);

            console.log(`Loaded rankings for ${this.rankingsData.length} repositories`);
            
        } catch (error) {
            console.error('Error loading rankings data:', error);
            throw error;
        }
    }

    async discoverRepositories() {
        try {
            const response = await fetch('AnalysisData/.directories.json');
            if (!response.ok) {
                // Fallback to hardcoded list
                return ['newrelic-dotnet-agent', 'newrelic-ruby-agent'];
            }
            const data = await response.json();
            return data.directories || ['newrelic-dotnet-agent', 'newrelic-ruby-agent'];
        } catch (error) {
            console.warn('Failed to load directories, using fallback:', error);
            return ['newrelic-dotnet-agent', 'newrelic-ruby-agent'];
        }
    }

    getCurrentRepository() {
        const select = document.getElementById('projectFilter');
        return select ? select.value : 'combined';
    }

    async renderPanel() {
        const panel = document.getElementById('developerScoringPanel');
        if (!panel) return;

        // Use selected repository from panel filter, or fallback to main dashboard filter
        const repository = this.selectedRepository || this.getCurrentRepository();
        let dataToShow = null;

        if (repository === 'combined' || !repository) {
            // Combine rankings from all repositories
            dataToShow = this.combineRankings();
        } else {
            // Show single repository
            const repoData = this.rankingsData.find(r => r.repository === repository);
            dataToShow = repoData ? repoData.data : null;
        }

        if (!dataToShow || !dataToShow.rankings) {
            panel.innerHTML = `
                <div class="p-4 text-center text-gray-500 dark:text-gray-400">
                    <i class="fas fa-info-circle mb-2"></i>
                    <p>No developer rankings data available</p>
                </div>
            `;
            return;
        }

        // Render panel content
        panel.innerHTML = this.generatePanelHTML(dataToShow);
        
        // Attach event listeners
        this.attachEventListeners();
    }

    combineRankings() {
        if (!this.rankingsData || this.rankingsData.length === 0) return null;

        const combined = {
            repository: 'combined',
            total_developers: 0,
            weights: this.rankingsData[0]?.data?.weights || {},
            rankings: [],
            generated_at: new Date().toISOString()
        };

        // Create a map to aggregate developer scores across repositories
        const developerMap = new Map();

        this.rankingsData.forEach(repoData => {
            const rankings = repoData.data?.rankings || [];
            rankings.forEach(ranking => {
                const email = ranking.email || ranking.developer;
                if (!developerMap.has(email)) {
                    developerMap.set(email, {
                        developer: ranking.developer,
                        email: email,
                        weighted_score: 0,
                        metrics: {
                            commits: 0,
                            lines_added: 0,
                            lines_deleted: 0,
                            total_churn: 0,
                            hotspot_score: 0,
                            hotspot_files_count: 0,
                            hotspot_commits: 0,
                            ownership_score: 0,
                            files_owned_count: 0,
                            complexity_score: 0,
                            communication_score: 0,
                            collaborators_count: 0,
                            recency_score: 0,
                            fragmentation_score: 0,
                            coupling_score: 0
                        },
                        normalized_scores: {},
                        repositories: []
                    });
                }

                const dev = developerMap.get(email);
                dev.repositories.push(repoData.repository);
                dev.weighted_score += ranking.weighted_score || 0;
                
                // Aggregate metrics
                if (ranking.metrics) {
                    Object.keys(dev.metrics).forEach(key => {
                        dev.metrics[key] += ranking.metrics[key] || 0;
                    });
                }

                // Merge normalized scores (average them)
                if (ranking.normalized_scores) {
                    Object.keys(ranking.normalized_scores).forEach(key => {
                        if (!dev.normalized_scores[key]) {
                            dev.normalized_scores[key] = [];
                        }
                        dev.normalized_scores[key].push(ranking.normalized_scores[key]);
                    });
                }
            });
        });

        // Calculate averages for normalized scores
        developerMap.forEach(dev => {
            Object.keys(dev.normalized_scores).forEach(key => {
                const values = dev.normalized_scores[key];
                dev.normalized_scores[key] = values.reduce((a, b) => a + b, 0) / values.length;
            });
        });

        // Convert to array and sort by weighted score
        combined.rankings = Array.from(developerMap.values())
            .map((dev, index) => ({
                rank: index + 1,
                ...dev
            }))
            .sort((a, b) => b.weighted_score - a.weighted_score)
            .map((dev, index) => ({
                ...dev,
                rank: index + 1
            }));

        combined.total_developers = combined.rankings.length;
        return combined;
    }

    generatePanelHTML(data) {
        // Get sorted rankings
        const sortedRankings = this.sortRankings(data.rankings);
        
        return `
            <div class="h-full flex flex-col">
                <!-- Header -->
                <div class="border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        <i class="fas fa-trophy mr-2 text-yellow-500"></i>
                        Developer Scoring
                    </h3>
                    
                    <!-- Repository Filter -->
                    <div class="mb-2">
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Repository
                        </label>
                        <select id="scoringRepoFilter" class="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-blue focus:border-transparent">
                            <option value="combined">All Repositories</option>
                            ${this.rankingsData.map(r => `
                                <option value="${r.repository}" ${this.selectedRepository === r.repository ? 'selected' : ''}>
                                    ${r.repository}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        ${data.total_developers} developers ranked
                    </p>
                </div>

                <!-- View Toggle and Sort Controls -->
                <div class="flex items-center justify-between mb-3 space-x-2">
                    <div class="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button id="viewCards" class="px-2 py-1 text-xs rounded transition-colors ${this.currentView === 'cards' ? 'bg-white dark:bg-gray-600 text-brand-blue dark:text-brand-light shadow' : 'text-gray-600 dark:text-gray-400'}" title="Card View">
                            <i class="fas fa-th-large"></i>
                        </button>
                        <button id="viewTable" class="px-2 py-1 text-xs rounded transition-colors ${this.currentView === 'table' ? 'bg-white dark:bg-gray-600 text-brand-blue dark:text-brand-light shadow' : 'text-gray-600 dark:text-gray-400'}" title="Table View">
                            <i class="fas fa-table"></i>
                        </button>
                    </div>
                    
                    <!-- Sort Controls (for table view) -->
                    ${this.currentView === 'table' ? `
                        <select id="sortBy" class="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            <option value="rank" ${this.sortBy === 'rank' ? 'selected' : ''}>Rank</option>
                            <option value="score" ${this.sortBy === 'score' ? 'selected' : ''}>Score</option>
                            <option value="commits" ${this.sortBy === 'commits' ? 'selected' : ''}>Commits</option>
                            <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>Name</option>
                        </select>
                        <button id="sortOrder" class="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500">
                            <i class="fas fa-sort-${this.sortOrder === 'asc' ? 'up' : 'down'}"></i>
                        </button>
                    ` : ''}
                </div>

                <!-- Content Area -->
                <div class="flex-1 overflow-y-auto">
                    ${this.currentView === 'cards' 
                        ? this.generateCardsView(sortedRankings.slice(0, 10), data.rankings[0])
                        : this.generateTableView(sortedRankings, data.rankings[0])
                    }
                </div>

                <!-- Footer with weights info -->
                <div class="border-t border-gray-200 dark:border-gray-700 pt-3 mt-4">
                    <button id="toggleWeightsInfo" class="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-blue dark:hover:text-brand-light transition-colors">
                        <i class="fas fa-info-circle mr-1"></i>
                        Scoring Weights
                    </button>
                    <div id="weightsInfo" class="hidden mt-2 text-xs text-gray-400 dark:text-gray-500">
                        ${this.generateWeightsHTML(data.weights)}
                    </div>
                </div>
            </div>
        `;
    }

    generateCardsView(developers, topDev) {
        return `
            <div class="space-y-2">
                ${developers.map(dev => this.generateDeveloperCard(dev, topDev)).join('')}
            </div>
        `;
    }

    generateTableView(rankings, topDev) {
        const maxScore = topDev?.weighted_score || 100;
        
        return `
            <div class="overflow-x-auto">
                <table class="w-full text-xs border-collapse">
                    <thead class="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
                        <tr class="border-b border-gray-300 dark:border-gray-600">
                            <th class="px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" data-sort="rank">
                                Rank <i class="fas fa-sort text-xs ml-1"></i>
                            </th>
                            <th class="px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" data-sort="name">
                                Developer <i class="fas fa-sort text-xs ml-1"></i>
                            </th>
                            <th class="px-2 py-2 text-right font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" data-sort="score">
                                Score <i class="fas fa-sort text-xs ml-1"></i>
                            </th>
                            <th class="px-2 py-2 text-right font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" data-sort="commits">
                                Commits <i class="fas fa-sort text-xs ml-1"></i>
                            </th>
                            <th class="px-2 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Churn</th>
                            <th class="px-2 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Ownership</th>
                            <th class="px-2 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Hotspots</th>
                            <th class="px-2 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Comm.</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800">
                        ${rankings.map((dev, index) => this.generateTableRow(dev, maxScore, index)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    generateTableRow(dev, maxScore, index) {
        const scorePercentage = maxScore > 0 ? (dev.weighted_score / maxScore * 100) : 0;
        const scoreColor = this.getScoreBarColor(scorePercentage);
        const rowClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700';
        
        return `
            <tr class="${rowClass} border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors" 
                data-developer="${dev.email || dev.developer}" 
                title="Click for details">
                <td class="px-2 py-2 text-center font-semibold text-gray-900 dark:text-white">
                    ${dev.rank}
                </td>
                <td class="px-2 py-2">
                    <div class="flex flex-col">
                        <span class="font-medium text-gray-900 dark:text-white">${dev.developer}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]" title="${dev.email || ''}">
                            ${this.formatEmail(dev.email || '')}
                        </span>
                    </div>
                </td>
                <td class="px-2 py-2">
                    <div class="flex flex-col items-end">
                        <span class="font-bold ${scoreColor.replace('bg-', 'text-').replace('-500', '-600')}">
                            ${dev.weighted_score.toFixed(1)}
                        </span>
                        <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                            <div class="${scoreColor} h-1 rounded-full transition-all" style="width: ${scorePercentage}%"></div>
                        </div>
                    </div>
                </td>
                <td class="px-2 py-2 text-right font-semibold text-gray-900 dark:text-white">
                    ${dev.metrics?.commits || 0}
                </td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                    ${(dev.metrics?.total_churn || 0).toLocaleString()}
                </td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                    ${Math.round(dev.metrics?.ownership_score || 0)}
                </td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                    ${dev.metrics?.hotspot_files_count || 0}
                </td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                    ${Math.round(dev.metrics?.communication_score || 0)}
                </td>
            </tr>
        `;
    }

    sortRankings(rankings) {
        const sorted = [...rankings];
        
        sorted.sort((a, b) => {
            let aVal, bVal;
            
            switch (this.sortBy) {
                case 'score':
                    aVal = a.weighted_score || 0;
                    bVal = b.weighted_score || 0;
                    break;
                case 'commits':
                    aVal = a.metrics?.commits || 0;
                    bVal = b.metrics?.commits || 0;
                    break;
                case 'name':
                    aVal = (a.developer || '').toLowerCase();
                    bVal = (b.developer || '').toLowerCase();
                    break;
                case 'rank':
                default:
                    aVal = a.rank || 0;
                    bVal = b.rank || 0;
                    break;
            }
            
            if (typeof aVal === 'string') {
                return this.sortOrder === 'asc' 
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            } else {
                return this.sortOrder === 'asc' 
                    ? aVal - bVal
                    : bVal - aVal;
            }
        });
        
        // Update ranks after sorting
        if (this.sortBy !== 'rank') {
            sorted.forEach((dev, index) => {
                dev.rank = index + 1;
            });
        }
        
        return sorted;
    }

    getScoreBarColor(percentage) {
        if (percentage >= 80) return 'bg-green-500';
        if (percentage >= 60) return 'bg-blue-500';
        if (percentage >= 40) return 'bg-yellow-500';
        if (percentage >= 20) return 'bg-orange-500';
        return 'bg-gray-400';
    }

    generateDeveloperCard(dev, topDev) {
        const scorePercentage = topDev && topDev.weighted_score > 0 
            ? (dev.weighted_score / topDev.weighted_score * 100).toFixed(1)
            : '0';
        
        const scoreColor = this.getScoreColor(dev.weighted_score, topDev?.weighted_score || 100);
        
        return `
            <div class="developer-card bg-gray-50 dark:bg-gray-800 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer" 
                 data-developer="${dev.email}">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center space-x-2 flex-1 min-w-0">
                        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${scoreColor} flex items-center justify-center text-white font-bold text-xs">
                            ${dev.rank}
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-sm font-semibold text-gray-900 dark:text-white truncate" title="${dev.developer}">
                                ${dev.developer}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 truncate" title="${dev.email}">
                                ${this.formatEmail(dev.email)}
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- Score Bar -->
                <div class="mb-2">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Score</span>
                        <span class="text-xs font-bold ${scoreColor.replace('bg-', 'text-')}">
                            ${dev.weighted_score.toFixed(1)}
                        </span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div class="${scoreColor} h-2 rounded-full transition-all duration-500" 
                             style="width: ${scorePercentage}%"></div>
                    </div>
                </div>

                <!-- Key Metrics -->
                <div class="grid grid-cols-3 gap-1 mt-2 text-xs">
                    <div class="text-center">
                        <p class="text-gray-600 dark:text-gray-400">Commits</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${dev.metrics?.commits || 0}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-gray-600 dark:text-gray-400">Ownership</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${Math.round(dev.metrics?.ownership_score || 0)}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-gray-600 dark:text-gray-400">Hotspots</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${dev.metrics?.hotspot_files_count || 0}</p>
                    </div>
                </div>
            </div>
        `;
    }

    generateWeightsHTML(weights) {
        if (!weights) return '<p>No weight information available</p>';
        
        const items = Object.entries(weights)
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => `
                <div class="flex justify-between py-1">
                    <span class="capitalize">${key.replace(/_/g, ' ')}</span>
                    <span class="font-semibold">${(value * 100).toFixed(0)}%</span>
                </div>
            `).join('');
        
        return `<div class="space-y-1">${items}</div>`;
    }

    getScoreColor(score, maxScore) {
        const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
        
        if (percentage >= 80) return 'from-green-500 to-green-600 bg-green-500';
        if (percentage >= 60) return 'from-blue-500 to-blue-600 bg-blue-500';
        if (percentage >= 40) return 'from-yellow-500 to-yellow-600 bg-yellow-500';
        if (percentage >= 20) return 'from-orange-500 to-orange-600 bg-orange-500';
        return 'from-gray-400 to-gray-500 bg-gray-400';
    }

    formatEmail(email) {
        if (!email) return '';
        if (email.length > 25) {
            return email.substring(0, 22) + '...';
        }
        return email;
    }

    attachEventListeners() {
        // Toggle weights info
        const toggleBtn = document.getElementById('toggleWeightsInfo');
        const weightsInfo = document.getElementById('weightsInfo');
        
        if (toggleBtn && weightsInfo) {
            toggleBtn.addEventListener('click', () => {
                weightsInfo.classList.toggle('hidden');
            });
        }

        // Repository filter
        const repoFilter = document.getElementById('scoringRepoFilter');
        if (repoFilter) {
            repoFilter.addEventListener('change', async (e) => {
                this.selectedRepository = e.target.value;
                await this.renderPanel();
            });
        }

        // View toggle buttons
        const viewCardsBtn = document.getElementById('viewCards');
        const viewTableBtn = document.getElementById('viewTable');
        
        if (viewCardsBtn) {
            viewCardsBtn.addEventListener('click', async () => {
                this.currentView = 'cards';
                await this.renderPanel();
            });
        }
        
        if (viewTableBtn) {
            viewTableBtn.addEventListener('click', async () => {
                this.currentView = 'table';
                await this.renderPanel();
            });
        }

        // Sort controls
        const sortBySelect = document.getElementById('sortBy');
        const sortOrderBtn = document.getElementById('sortOrder');
        
        if (sortBySelect) {
            sortBySelect.addEventListener('change', async (e) => {
                this.sortBy = e.target.value;
                await this.renderPanel();
            });
        }
        
        if (sortOrderBtn) {
            sortOrderBtn.addEventListener('click', async () => {
                this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                await this.renderPanel();
            });
        }

        // Table header sorting
        const tableHeaders = document.querySelectorAll('th[data-sort]');
        tableHeaders.forEach(header => {
            header.addEventListener('click', async () => {
                const sortField = header.dataset.sort;
                if (this.sortBy === sortField) {
                    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortBy = sortField;
                    this.sortOrder = 'asc';
                }
                await this.renderPanel();
            });
        });

        // Developer card/row click handlers
        const cards = document.querySelectorAll('.developer-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const email = card.dataset.developer;
                this.showDeveloperDetails(email);
            });
        });

        // Table row click handlers
        const tableRows = document.querySelectorAll('tbody tr[data-developer]');
        tableRows.forEach(row => {
            row.addEventListener('click', () => {
                const identifier = row.dataset.developer;
                this.showDeveloperDetails(identifier);
            });
        });
    }

    showDeveloperDetails(email) {
        const repository = this.selectedRepository || this.getCurrentRepository();
        let dataToShow = null;

        if (repository === 'combined' || !repository) {
            dataToShow = this.combineRankings();
        } else {
            const repoData = this.rankingsData.find(r => r.repository === repository);
            dataToShow = repoData ? repoData.data : null;
        }

        if (!dataToShow) return;

        const dev = dataToShow.rankings.find(d => 
            (d.email || d.developer) === email
        );

        if (!dev) return;

        // Create and show modal with developer details
        this.showDeveloperModal(dev, dataToShow);
    }

    showDeveloperModal(dev, data) {
        // Create modal HTML
        const modalHTML = `
            <div id="developerModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" 
                 style="display: flex;" onclick="event.target.id === 'developerModal' && this.remove()">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" 
                     onclick="event.stopPropagation()">
                    <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                            ${dev.developer}
                        </h3>
                        <button onclick="document.getElementById('developerModal').remove()" 
                                class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="p-6">
                        ${this.generateDeveloperDetailsHTML(dev, data)}
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existing = document.getElementById('developerModal');
        if (existing) existing.remove();

        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    generateDeveloperDetailsHTML(dev, data) {
        const normalized = dev.normalized_scores || {};
        
        return `
            <div class="space-y-6">
                <!-- Overall Score -->
                <div class="text-center p-4 bg-gradient-to-br from-brand-blue to-brand-dark rounded-lg text-white">
                    <p class="text-sm opacity-90">Overall Score</p>
                    <p class="text-4xl font-bold">${dev.weighted_score.toFixed(1)}</p>
                    <p class="text-sm opacity-75 mt-1">Rank #${dev.rank} of ${data.total_developers}</p>
                </div>

                <!-- Metrics Grid -->
                <div>
                    <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Metrics</h4>
                    <div class="grid grid-cols-2 gap-3">
                        ${this.generateMetricCard('Commits', dev.metrics?.commits || 0, normalized.commits || 0)}
                        ${this.generateMetricCard('Churn', dev.metrics?.total_churn || 0, normalized.churn || 0)}
                        ${this.generateMetricCard('Hotspot Work', dev.metrics?.hotspot_score?.toFixed(2) || 0, normalized.hotspot_work || 0)}
                        ${this.generateMetricCard('Ownership', dev.metrics?.ownership_score?.toFixed(2) || 0, normalized.ownership || 0)}
                        ${this.generateMetricCard('Complexity', dev.metrics?.complexity_score?.toFixed(2) || 0, normalized.complexity || 0)}
                        ${this.generateMetricCard('Communication', dev.metrics?.communication_score?.toFixed(2) || 0, normalized.communication || 0)}
                        ${this.generateMetricCard('Recency', dev.metrics?.recency_score?.toFixed(2) || 0, normalized.recency || 0)}
                        ${this.generateMetricCard('Fragmentation', dev.metrics?.fragmentation_score?.toFixed(2) || 0, normalized.fragmentation || 0)}
                    </div>
                </div>

                <!-- Additional Info -->
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p class="text-gray-600 dark:text-gray-400">Files Owned</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${dev.metrics?.files_owned_count || 0}</p>
                    </div>
                    <div>
                        <p class="text-gray-600 dark:text-gray-400">Collaborators</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${dev.metrics?.collaborators_count || 0}</p>
                    </div>
                    <div>
                        <p class="text-gray-600 dark:text-gray-400">Lines Added</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${(dev.metrics?.lines_added || 0).toLocaleString()}</p>
                    </div>
                    <div>
                        <p class="text-gray-600 dark:text-gray-400">Lines Deleted</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${(dev.metrics?.lines_deleted || 0).toLocaleString()}</p>
                    </div>
                </div>

                ${dev.last_commit_date ? `
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Last Commit</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${new Date(dev.metrics?.last_commit_date || dev.last_commit_date).toLocaleDateString()}</p>
                    </div>
                ` : ''}

                ${dev.repositories ? `
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Repositories</p>
                        <div class="flex flex-wrap gap-2">
                            ${dev.repositories.map(r => `
                                <span class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                                    ${r}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    generateMetricCard(label, value, normalized) {
        return `
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">${label}</p>
                <p class="text-lg font-bold text-gray-900 dark:text-white">${value}</p>
                ${normalized > 0 ? `
                    <div class="mt-2">
                        <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                            <div class="bg-brand-blue h-1.5 rounded-full" style="width: ${normalized}%"></div>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Normalized: ${normalized.toFixed(1)}%</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async refresh() {
        await this.loadRankingsData();
        await this.renderPanel();
    }
}

// Initialize on page load
window.DeveloperScoring = DeveloperScoring;
