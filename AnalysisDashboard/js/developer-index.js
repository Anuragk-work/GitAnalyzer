/**
 * Developer Index Dashboard
 * Displays a comprehensive directory of all developers with their contributions and metrics
 */

class DeveloperIndexDashboard {
    constructor() {
        this.isInitialized = false;
        this.rankingsData = [];
        this.allDevelopers = [];
        this.filteredDevelopers = [];
        this.currentRepository = 'combined';
        this.currentView = 'cards'; // 'cards' or 'table'
        this.sortBy = 'rank'; // 'rank', 'score', 'commits', 'name'
        this.sortOrder = 'asc'; // 'asc' or 'desc'
        this.scoringWeights = null; // Store weights from rankings data
        this.weightsPanelExpanded = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('🚀 Initializing Developer Index...');
        
        try {
            // Show loading state
            const loadingIndicator = document.getElementById('loadingIndicator');
            const dashboardContent = document.getElementById('dashboardContent');
            
            // Load developer rankings data
            await this.loadDeveloperRankings();
            
            // Combine and prepare developer data
            this.prepareDeveloperData();
            
            // Render the developer directory
            this.renderDeveloperDirectory();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Populate repository filter
            this.populateRepositoryFilter();
            
            // Render scoring weights panel
            this.renderScoringWeights();
            
            // Hide loading and show content
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (dashboardContent) dashboardContent.classList.remove('hidden');
            
            // Update last updated time
            const lastUpdated = document.getElementById('lastUpdated');
            if (lastUpdated) {
                lastUpdated.textContent = new Date().toLocaleString();
            }
            
            this.isInitialized = true;
            console.log('✅ Developer Index initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing Developer Index:', error);
            this.showError('Failed to load developer index. Please refresh the page.');
        }
    }

    async loadDeveloperRankings() {
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

            console.log(`📊 Loaded rankings for ${this.rankingsData.length} repositories`);
            
        } catch (error) {
            console.error('❌ Error loading rankings data:', error);
            throw error;
        }
    }

    async discoverRepositories() {
        try {
            const response = await fetch('AnalysisData/.directories.json');
            if (!response.ok) {
                console.warn('⚠️ .directories.json not found. Please run: python3 scripts/generate-directory-listing.py');
                return [];
            }
            const data = await response.json();
            if (!data.directories || data.directories.length === 0) {
                console.warn('⚠️ No repositories found in .directories.json');
                return [];
            }
            console.log(`✅ Discovered ${data.directories.length} repositories from .directories.json`);
            return data.directories;
        } catch (error) {
            console.error('❌ Failed to load directories:', error);
            console.warn('⚠️ Please run: python3 scripts/generate-directory-listing.py');
            return [];
        }
    }

    prepareDeveloperData() {
        // Create a map to aggregate developer data across repositories
        const developerMap = new Map();

        // Store weights from first repository (assuming same weights across repos)
        if (this.rankingsData.length > 0 && this.rankingsData[0].data?.weights) {
            this.scoringWeights = this.rankingsData[0].data.weights;
        }

        this.rankingsData.forEach(repoData => {
            const rankings = repoData.data?.rankings || [];
            rankings.forEach(ranking => {
                const email = ranking.email || ranking.developer;
                const name = ranking.developer || ranking.email || 'Unknown';
                
                if (!developerMap.has(email)) {
                    developerMap.set(email, {
                        name: name,
                        email: email,
                        weighted_score: 0,
                        total_commits: 0,
                        repositories: [],
                        metrics: {
                            commits: 0,
                            lines_added: 0,
                            lines_deleted: 0,
                            total_churn: 0,
                            hotspot_score: 0,
                            hotspot_files_count: 0,
                            hotspot_commits: 0,
                            ownership_score: 0,
                            complexity_score: 0,
                            communication_score: 0,
                            recency_score: 0,
                            fragmentation_score: 0,
                            coupling_score: 0
                        }
                    });
                }

                const dev = developerMap.get(email);
                if (!dev.repositories.includes(repoData.repository)) {
                    dev.repositories.push(repoData.repository);
                }
                dev.weighted_score += ranking.weighted_score || 0;
                
                // Aggregate metrics
                if (ranking.metrics) {
                    dev.total_commits += ranking.metrics.commits || 0;
                    dev.metrics.commits += ranking.metrics.commits || 0;
                    dev.metrics.lines_added += ranking.metrics.lines_added || 0;
                    dev.metrics.lines_deleted += ranking.metrics.lines_deleted || 0;
                    dev.metrics.total_churn += ranking.metrics.total_churn || 0;
                    dev.metrics.hotspot_score += ranking.metrics.hotspot_score || 0;
                    dev.metrics.hotspot_files_count += ranking.metrics.hotspot_files_count || 0;
                    dev.metrics.hotspot_commits += ranking.metrics.hotspot_commits || 0;
                    dev.metrics.ownership_score += ranking.metrics.ownership_score || 0;
                    dev.metrics.complexity_score += ranking.metrics.complexity_score || 0;
                    dev.metrics.communication_score += ranking.metrics.communication_score || 0;
                    dev.metrics.recency_score += ranking.metrics.recency_score || 0;
                    dev.metrics.fragmentation_score += ranking.metrics.fragmentation_score || 0;
                    dev.metrics.coupling_score += ranking.metrics.coupling_score || 0;
                }
            });
        });

        // Convert to array and sort by weighted score
        this.allDevelopers = Array.from(developerMap.values())
            .sort((a, b) => b.weighted_score - a.weighted_score)
            .map((dev, index) => ({
                ...dev,
                rank: index + 1
            }));

        this.filteredDevelopers = [...this.allDevelopers];
        
        console.log(`👥 Prepared data for ${this.allDevelopers.length} developers`);
    }

    populateRepositoryFilter() {
        const projectFilter = document.getElementById('projectFilter');
        if (!projectFilter) return;

        // Clear existing options except "All Repositories"
        projectFilter.innerHTML = '<option value="combined">All Repositories</option>';

        // Add repository options
        this.rankingsData.forEach(repoData => {
            const option = document.createElement('option');
            option.value = repoData.repository;
            option.textContent = this.formatRepositoryName(repoData.repository);
            projectFilter.appendChild(option);
        });
    }

    formatRepositoryName(repo) {
        return repo
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    renderDeveloperDirectory() {
        const container = document.getElementById('developerIndexContent');
        if (!container) return;

        // Update view toggle UI first
        this.updateViewToggleUI();

        if (this.filteredDevelopers.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                    <i class="fas fa-search fa-3x mb-4"></i>
                    <p class="text-lg">No developers found matching your criteria</p>
                </div>
            `;
            return;
        }

        // Sort developers based on current sort settings
        const sortedDevelopers = this.sortDevelopers([...this.filteredDevelopers]);

        // Get top developer for score percentage calculation
        const topDev = sortedDevelopers[0];

        // Render based on current view
        let html = '';
        if (this.currentView === 'cards') {
            html = `
                <div class="space-y-3">
                    ${sortedDevelopers.map(dev => this.generateDeveloperCard(dev, topDev)).join('')}
                </div>
            `;
        } else {
            html = this.generateTableView(sortedDevelopers, topDev);
        }

        html += `
            <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 text-center">
                Showing ${this.filteredDevelopers.length} of ${this.allDevelopers.length} developers
            </div>
        `;

        container.innerHTML = html;
        
        // Attach table event listeners if in table view
        if (this.currentView === 'table') {
            this.attachTableViewListeners();
        }
    }

    updateViewToggleUI() {
        const viewToggleContainer = document.getElementById('viewToggleContainer');
        if (!viewToggleContainer) return;

        viewToggleContainer.innerHTML = `
            <div class="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button id="viewCards" class="px-3 py-1.5 text-sm rounded transition-colors ${this.currentView === 'cards' ? 'bg-white dark:bg-gray-600 text-brand-blue dark:text-brand-light shadow' : 'text-gray-600 dark:text-gray-400'}" title="Card View">
                    <i class="fas fa-th-large mr-1"></i>Cards
                </button>
                <button id="viewTable" class="px-3 py-1.5 text-sm rounded transition-colors ${this.currentView === 'table' ? 'bg-white dark:bg-gray-600 text-brand-blue dark:text-brand-light shadow' : 'text-gray-600 dark:text-gray-400'}" title="Table View">
                    <i class="fas fa-table mr-1"></i>Table
                </button>
            </div>
            ${this.currentView === 'table' ? `
                <select id="sortBy" class="text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="rank" ${this.sortBy === 'rank' ? 'selected' : ''}>Rank</option>
                    <option value="score" ${this.sortBy === 'score' ? 'selected' : ''}>Score</option>
                    <option value="commits" ${this.sortBy === 'commits' ? 'selected' : ''}>Commits</option>
                    <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>Name</option>
                </select>
                <button id="sortOrder" class="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500">
                    <i class="fas fa-sort-${this.sortOrder === 'asc' ? 'up' : 'down'}"></i>
                </button>
            ` : ''}
        `;

        // Re-attach event listeners
        const viewCards = document.getElementById('viewCards');
        const viewTable = document.getElementById('viewTable');
        if (viewCards) {
            viewCards.addEventListener('click', () => {
                this.currentView = 'cards';
                this.renderDeveloperDirectory();
            });
        }
        if (viewTable) {
            viewTable.addEventListener('click', () => {
                this.currentView = 'table';
                this.renderDeveloperDirectory();
            });
        }
    }

    generateTableView(developers, topDev) {
        const maxScore = topDev?.weighted_score || 100;
        
        return `
            <div class="overflow-x-auto">
                <table class="w-full text-sm border-collapse">
                    <thead class="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
                        <tr class="border-b border-gray-300 dark:border-gray-600">
                            <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" data-sort="rank">
                                Rank <i class="fas fa-sort text-xs ml-1"></i>
                            </th>
                            <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" data-sort="name">
                                Developer <i class="fas fa-sort text-xs ml-1"></i>
                            </th>
                            <th class="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" data-sort="score">
                                Score <i class="fas fa-sort text-xs ml-1"></i>
                            </th>
                            <th class="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" data-sort="commits">
                                Commits <i class="fas fa-sort text-xs ml-1"></i>
                            </th>
                            <th class="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Ownership</th>
                            <th class="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Hotspots</th>
                            <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Repositories</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800">
                        ${developers.map((dev, index) => this.generateTableRow(dev, maxScore, index)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    generateTableRow(dev, maxScore, index) {
        const scorePercentage = maxScore > 0 ? (dev.weighted_score / maxScore * 100) : 0;
        const scoreColor = this.getScoreBarColor(scorePercentage);
        const rowClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700';
        
        // Format email for display
        const displayEmail = dev.email.length > 35 
            ? dev.email.substring(0, 35) + '...' 
            : dev.email;
        
        return `
            <tr class="${rowClass} border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                <td class="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
                    ${dev.rank}
                </td>
                <td class="px-4 py-3">
                    <div class="flex flex-col">
                        <span class="font-medium text-gray-900 dark:text-white">${this.escapeHtml(dev.name)}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title="${dev.email}">
                            ${this.escapeHtml(displayEmail)}
                        </span>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <div class="flex flex-col items-end">
                        <span class="font-bold ${scoreColor.replace('bg-', 'text-').replace('-500', '-600')} mb-1">
                            ${dev.weighted_score.toFixed(1)}
                        </span>
                        <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 max-w-[80px]">
                            <div class="${scoreColor} h-1.5 rounded-full transition-all" style="width: ${scorePercentage}%"></div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    ${(dev.total_commits || dev.metrics.commits || 0).toLocaleString()}
                </td>
                <td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    ${Math.round(dev.metrics.ownership_score || 0)}
                </td>
                <td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    ${Math.round(dev.metrics.hotspot_score || 0)}
                </td>
                <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1 max-w-[200px]">
                        ${dev.repositories.map(repo => `
                            <span class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                                ${this.formatRepositoryName(repo)}
                            </span>
                        `).join('')}
                    </div>
                </td>
            </tr>
        `;
    }

    sortDevelopers(developers) {
        const sorted = [...developers];
        
        sorted.sort((a, b) => {
            let aVal, bVal;
            
            switch (this.sortBy) {
                case 'score':
                    aVal = a.weighted_score || 0;
                    bVal = b.weighted_score || 0;
                    break;
                case 'commits':
                    aVal = a.total_commits || a.metrics.commits || 0;
                    bVal = b.total_commits || b.metrics.commits || 0;
                    break;
                case 'name':
                    aVal = (a.name || '').toLowerCase();
                    bVal = (b.name || '').toLowerCase();
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
        
        // Update ranks after sorting if needed
        if (this.sortBy !== 'rank') {
            sorted.forEach((dev, index) => {
                dev.displayRank = index + 1;
            });
        }
        
        return sorted;
    }

    generateDeveloperCard(dev, topDev) {
        const scorePercentage = topDev && topDev.weighted_score > 0 
            ? (dev.weighted_score / topDev.weighted_score * 100).toFixed(1)
            : '0';
        
        const scoreColor = this.getScoreBarColor(parseFloat(scorePercentage));
        const badgeColor = this.getBadgeColor(dev.rank);
        
        // Format email for display
        const displayEmail = dev.email.length > 30 
            ? dev.email.substring(0, 30) + '...' 
            : dev.email;
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all cursor-pointer">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-3 flex-1 min-w-0">
                        <div class="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${badgeColor} flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            ${dev.rank}
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-base font-semibold text-gray-900 dark:text-white truncate" title="${dev.name}">
                                ${this.escapeHtml(dev.name)}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 truncate" title="${dev.email}">
                                ${this.escapeHtml(displayEmail)}
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- Score Bar -->
                <div class="mb-3">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Score</span>
                        <span class="text-sm font-bold ${scoreColor.replace('bg-', 'text-').replace('-500', '-600')}">
                            ${dev.weighted_score.toFixed(1)}
                        </span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div class="${scoreColor} h-2.5 rounded-full transition-all duration-500" 
                             style="width: ${scorePercentage}%"></div>
                    </div>
                </div>

                <!-- Key Metrics - Compact Grid -->
                <div class="grid grid-cols-5 gap-1.5 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div class="text-center">
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Commits</p>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${(dev.total_commits || dev.metrics.commits || 0).toLocaleString()}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Ownership</p>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${Math.round(dev.metrics.ownership_score || 0)}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Hotspots</p>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${(dev.metrics.hotspot_files_count || 0).toLocaleString()}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Churn</p>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${(dev.metrics.total_churn || 0).toLocaleString()}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Communication</p>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${Math.round(dev.metrics.communication_score || 0)}</p>
                    </div>
                </div>

                <!-- Additional Metrics - Compact Second Row -->
                <div class="grid grid-cols-5 gap-1.5 mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700">
                    <div class="text-center">
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Complexity</p>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${Math.round(dev.metrics.complexity_score || 0)}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Recency</p>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${Math.round(dev.metrics.recency_score || 0)}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Fragmentation</p>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${Math.round(dev.metrics.fragmentation_score || 0)}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Coupling</p>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${Math.round(dev.metrics.coupling_score || 0)}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Hotspot Commits</p>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${(dev.metrics.hotspot_commits || 0).toLocaleString()}</p>
                    </div>
                </div>
                
                <!-- Repositories Badge -->
                ${dev.repositories && dev.repositories.length > 0 ? `
                    <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div class="flex flex-wrap gap-1">
                            ${dev.repositories.map(repo => `
                                <span class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md font-medium">
                                    ${this.formatRepositoryName(repo)}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    getBadgeColor(rank) {
        if (rank === 1) return 'from-green-500 to-green-600';
        if (rank <= 3) return 'from-blue-500 to-blue-600';
        if (rank <= 10) return 'from-yellow-500 to-yellow-600';
        return 'from-gray-400 to-gray-500';
    }

    getScoreBarColor(percentage) {
        if (percentage >= 80) return 'bg-green-500';
        if (percentage >= 60) return 'bg-blue-500';
        if (percentage >= 40) return 'bg-yellow-500';
        if (percentage >= 20) return 'bg-orange-500';
        return 'bg-gray-400';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupEventListeners() {
        // Search input
        const developerSearch = document.getElementById('developerSearch');
        if (developerSearch) {
            developerSearch.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Repository filter
        const projectFilter = document.getElementById('projectFilter');
        if (projectFilter) {
            projectFilter.addEventListener('change', (e) => {
                this.handleRepositoryFilter(e.target.value);
            });
        }

        // View toggle buttons are attached in updateViewToggleUI()
        
        // Refresh button
        const refreshData = document.getElementById('refreshData');
        if (refreshData) {
            refreshData.addEventListener('click', () => {
                this.init();
            });
        }

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                document.documentElement.classList.toggle('dark');
            });
        }

        // Sidebar toggle for mobile
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('-translate-x-full');
            });
        }

        // Scoring weights toggle
        const toggleWeightsInfo = document.getElementById('toggleWeightsInfo');
        const weightsInfo = document.getElementById('weightsInfo');
        if (toggleWeightsInfo && weightsInfo) {
            toggleWeightsInfo.addEventListener('click', (e) => {
                e.stopPropagation();
                this.weightsPanelExpanded = !this.weightsPanelExpanded;
                if (this.weightsPanelExpanded) {
                    weightsInfo.classList.remove('hidden');
                } else {
                    weightsInfo.classList.add('hidden');
                }
            });
            
            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!weightsInfo.contains(e.target) && !toggleWeightsInfo.contains(e.target)) {
                    this.weightsPanelExpanded = false;
                    weightsInfo.classList.add('hidden');
                }
            });
        }
    }

    renderScoringWeights() {
        const weightsContent = document.getElementById('weightsContent');
        if (!weightsContent || !this.scoringWeights) return;

        const weights = Object.entries(this.scoringWeights)
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => {
                const displayName = key
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                
                return `
                    <div class="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        <span class="text-gray-700 dark:text-gray-300 truncate mr-2">${displayName}</span>
                        <span class="font-semibold text-gray-900 dark:text-white flex-shrink-0">${(value * 100).toFixed(0)}%</span>
                    </div>
                `;
            }).join('');

        weightsContent.innerHTML = `
            <div class="space-y-0">
                ${weights}
            </div>
        `;
    }


    attachTableViewListeners() {
        // Sort dropdown
        const sortBy = document.getElementById('sortBy');
        if (sortBy) {
            sortBy.value = this.sortBy;
            sortBy.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.renderDeveloperDirectory();
            });
        }

        // Sort order button
        const sortOrder = document.getElementById('sortOrder');
        if (sortOrder) {
            const icon = sortOrder.querySelector('i');
            if (icon) {
                icon.className = `fas fa-sort-${this.sortOrder === 'asc' ? 'up' : 'down'}`;
            }
            sortOrder.addEventListener('click', () => {
                this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                this.renderDeveloperDirectory();
            });
        }

        // Table header click handlers for sorting
        const headers = document.querySelectorAll('[data-sort]');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const sortField = header.getAttribute('data-sort');
                if (this.sortBy === sortField) {
                    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortBy = sortField;
                    this.sortOrder = 'asc';
                }
                this.renderDeveloperDirectory();
            });
        });
    }

    handleSearch(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) {
            // If search is empty, just apply repository filter
            this.applyFilters();
            return;
        }

        // Filter by search term
        this.filteredDevelopers = this.allDevelopers.filter(dev => {
            // Check if repository filter applies
            if (this.currentRepository !== 'combined') {
                if (!dev.repositories.includes(this.currentRepository)) {
                    return false;
                }
            }

            // Check search term
            return dev.name.toLowerCase().includes(term) || 
                   dev.email.toLowerCase().includes(term);
        });

        this.renderDeveloperDirectory();
    }

    handleRepositoryFilter(repository) {
        this.currentRepository = repository;
        this.applyFilters();
    }

    applyFilters() {
        const searchTerm = document.getElementById('developerSearch')?.value.toLowerCase().trim() || '';
        
        this.filteredDevelopers = this.allDevelopers.filter(dev => {
            // Apply repository filter
            if (this.currentRepository !== 'combined') {
                if (!dev.repositories.includes(this.currentRepository)) {
                    return false;
                }
            }

            // Apply search filter
            if (searchTerm) {
                if (!dev.name.toLowerCase().includes(searchTerm) && 
                    !dev.email.toLowerCase().includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        this.renderDeveloperDirectory();
    }

    showError(message) {
        const container = document.getElementById('developerIndexContent');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-12 text-red-600 dark:text-red-400">
                    <i class="fas fa-exclamation-circle fa-3x mb-4"></i>
                    <p class="text-lg">${this.escapeHtml(message)}</p>
                </div>
            `;
        }
        
        const loadingIndicator = document.getElementById('loadingIndicator');
        const dashboardContent = document.getElementById('dashboardContent');
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        if (dashboardContent) dashboardContent.classList.remove('hidden');
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    if (window.DeveloperIndexDashboard) {
        const dashboard = new window.DeveloperIndexDashboard();
        await dashboard.init();
        window.developerIndexDashboard = dashboard; // Store globally
    }
});

// Export for use in other scripts
window.DeveloperIndexDashboard = DeveloperIndexDashboard;
