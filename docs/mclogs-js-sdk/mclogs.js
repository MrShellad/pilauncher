/**
 * LogShare.CNᴺᵉˣᵀ JavaScript SDK
 * 高性能 Minecraft/Hytale 日志分享与分析 API 封装
 * 支持浏览器和 Node.js 环境
 */
class LogShareSDK {
    /**
     * 创建 SDK 实例
     * @param {Object} options - 配置选项
     * @param {string} options.baseUrl - API 基础 URL，默认 https://api.logshare.cn
     * @param {number} options.timeout - 请求超时时间（毫秒），默认 30000
     * @param {Function} options.onError - 全局错误处理回调
     */
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'https://api.logshare.cn';
        this.timeout = options.timeout || 30000;
        this.onError = options.onError || null;
        this.version = '1.0.0';
        
        // 环境检测
        this.isNode = typeof window === 'undefined';
        
        // Node.js 环境下需要动态导入 fetch
        if (this.isNode && typeof fetch === 'undefined') {
            this._fetch = null;
            this._initNodeFetch();
        }
    }

    /**
     * Node.js 环境下初始化 fetch
     */
    async _initNodeFetch() {
        try {
            const { default: fetch } = await import('node-fetch');
            this._fetch = fetch;
        } catch (err) {
            throw new Error('Node.js 环境需要安装 node-fetch: npm install node-fetch');
        }
    }

    /**
     * 获取 fetch 函数
     */
    async _getFetch() {
        if (this.isNode && this._fetch === null) {
            await this._initNodeFetch();
        }
        return this.isNode ? this._fetch : fetch;
    }

    /**
     * 构建请求 URL
     * @param {string} endpoint - API 端点
     */
    _buildUrl(endpoint) {
        return `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    }

    /**
     * 带超时的 fetch 请求
     * @param {string} url - 请求地址
     * @param {Object} options - fetch 选项
     */
    async _fetchWithTimeout(url, options = {}) {
        const fetchFn = await this._getFetch();
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetchFn(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new LogShareError('请求超时', 'TIMEOUT_ERROR', 408);
            }
            throw error;
        }
    }

    /**
     * 处理 API 响应
     * @param {Response} response - fetch 响应对象
     * @param {string} type - 返回类型 ('json' | 'text')
     */
    async _handleResponse(response, type = 'json') {
        // 处理速率限制
        if (response.status === 429) {
            const errorData = await response.json();
            throw new LogShareError(
                errorData.error || '请求过于频繁，请稍后重试',
                'RATE_LIMIT_ERROR',
                429
            );
        }

        // 处理其他 HTTP 错误
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                // 解析失败时使用默认错误信息
            }
            throw new LogShareError(errorMessage, 'API_ERROR', response.status);
        }

        return type === 'text' ? await response.text() : await response.json();
    }

    /**
     * 统一错误处理
     * @param {Error} error - 错误对象
     */
    _handleError(error) {
        if (this.onError) {
            this.onError(error);
        }
        throw error;
    }

    // ==================== 核心 API 方法 ====================

    /**
     * 粘贴/上传日志文件
     * @param {string} content - 原始日志内容（最大 10MiB 或 25k 行）
     * @returns {Promise<{success: boolean, id: string, url: string, raw: string}>}
     */
    async paste(content) {
        try {
            if (!content || typeof content !== 'string') {
                throw new LogShareError('日志内容不能为空', 'VALIDATION_ERROR');
            }

            const response = await this._fetchWithTimeout(
                this._buildUrl('/1/log'),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({ content })
                }
            );

            return await this._handleResponse(response, 'json');
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 即时分析日志（不保存到数据库）
     * @param {string} content - 原始日志内容
     * @returns {Promise<Object>} 分析结果
     */
    async analyse(content) {
        try {
            if (!content || typeof content !== 'string') {
                throw new LogShareError('日志内容不能为空', 'VALIDATION_ERROR');
            }

            const response = await this._fetchWithTimeout(
                this._buildUrl('/1/analyse'),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({ content })
                }
            );

            return await this._handleResponse(response, 'json');
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 获取日志洞察分析
     * @param {string} id - 日志 ID
     * @returns {Promise<{analysis: {software: string, version: string, issues: Array}}>}
     */
    async getInsights(id) {
        try {
            if (!id || typeof id !== 'string') {
                throw new LogShareError('日志 ID 不能为空', 'VALIDATION_ERROR');
            }

            const response = await this._fetchWithTimeout(
                this._buildUrl(`/1/insights/${encodeURIComponent(id)}`)
            );

            return await this._handleResponse(response, 'json');
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 获取原始日志内容
     * @param {string} id - 日志 ID
     * @returns {Promise<string>} 原始日志文本
     */
    async getRaw(id) {
        try {
            if (!id || typeof id !== 'string') {
                throw new LogShareError('日志 ID 不能为空', 'VALIDATION_ERROR');
            }

            const response = await this._fetchWithTimeout(
                this._buildUrl(`/1/raw/${encodeURIComponent(id)}`)
            );

            return await this._handleResponse(response, 'text');
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 使用大模型智能分析日志
     * @param {string} id - 日志 ID
     * @returns {Promise<{success: boolean, analysis: string}>} Markdown 格式分析报告
     */
    async getAIAnalysis(id) {
        try {
            if (!id || typeof id !== 'string') {
                throw new LogShareError('日志 ID 不能为空', 'VALIDATION_ERROR');
            }

            const response = await this._fetchWithTimeout(
                this._buildUrl(`/1/ai-analysis/${encodeURIComponent(id)}`)
            );

            return await this._handleResponse(response, 'json');
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 获取存储限制参数
     * @returns {Promise<{storageTime: number, maxLength: number, maxLines: number}>}
     */
    async getLimits() {
        try {
            const response = await this._fetchWithTimeout(
                this._buildUrl('/1/limits')
            );

            return await this._handleResponse(response, 'json');
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 删除日志文件
     * @param {string} id - 日志 ID
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async delete(id) {
        try {
            if (!id || typeof id !== 'string') {
                throw new LogShareError('日志 ID 不能为空', 'VALIDATION_ERROR');
            }

            const response = await this._fetchWithTimeout(
                this._buildUrl(`/1/delete/${encodeURIComponent(id)}`),
                {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            return await this._handleResponse(response, 'json');
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 获取速率限制错误示例（用于测试）
     * @returns {Promise<Object>}
     */
    async getRateLimitError() {
        try {
            const response = await this._fetchWithTimeout(
                this._buildUrl('/1/errors/rate')
            );

            return await this._handleResponse(response, 'json');
        } catch (error) {
            return this._handleError(error);
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 批量上传多个日志
     * @param {Array<{name: string, content: string}>} logs - 日志数组
     * @returns {Promise<Array<{name: string, result: Object, error: Error}>>}
     */
    async batchPaste(logs) {
        const results = await Promise.allSettled(
            logs.map(async (log) => {
                try {
                    const result = await this.paste(log.content);
                    return { name: log.name, result, error: null };
                } catch (error) {
                    return { name: log.name, result: null, error };
                }
            })
        );

        return results.map(r => r.status === 'fulfilled' ? r.value : r.reason);
    }

    /**
     * 完整分析流程：上传并获取 AI 分析
     * @param {string} content - 日志内容
     * @param {Object} options - 选项
     * @param {boolean} options.includeInsights - 是否同时获取基础洞察
     * @returns {Promise<{upload: Object, aiAnalysis: Object, insights?: Object}>}
     */
    async fullAnalysis(content, options = {}) {
        const upload = await this.paste(content);
        
        if (!upload.success) {
            throw new LogShareError('上传失败', 'UPLOAD_ERROR');
        }

        const [aiAnalysis, insights] = await Promise.all([
            this.getAIAnalysis(upload.id),
            options.includeInsights ? this.getInsights(upload.id) : Promise.resolve(null)
        ]);

        return {
            upload,
            aiAnalysis,
            ...(insights && { insights })
        };
    }

    /**
     * 验证日志 ID 格式
     * @param {string} id - 日志 ID
     */
    static isValidId(id) {
        return typeof id === 'string' && /^[a-zA-Z0-9]+$/.test(id) && id.length >= 6;
    }
}

/**
 * 自定义错误类
 */
class LogShareError extends Error {
    constructor(message, code, statusCode = null) {
        super(message);
        this.name = 'LogShareError';
        this.code = code;
        this.statusCode = statusCode;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            timestamp: this.timestamp
        };
    }
}

// ==================== 导出 ====================

// ES Module 导出
export { LogShareSDK, LogShareError };

// 默认导出
export default LogShareSDK;

// CommonJS 兼容
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LogShareSDK, LogShareError };
    module.exports.default = LogShareSDK;
}

// 浏览器全局变量
if (typeof window !== 'undefined') {
    window.LogShareSDK = LogShareSDK;
    window.LogShareError = LogShareError;
    
    // 向后兼容旧名称
    window.Mclogs = LogShareSDK;
}
