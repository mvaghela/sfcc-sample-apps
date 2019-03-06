require('colors');

const crypto = require('crypto');

const { assert } = require('../utils/assert');
const { autoBind } = require('../utils/autobind');
const folderHash = require('../utils/observable-folder-hash');
const fs = require('../utils/filesystem');
const TalonContext = require('./talon-context');

const { log } = console;

class ContextService {
    /**
     * Start the Talon context and computes the template version key
     * based on the given configuration by computing a hash for srcDir
     * and watching it for changes.
     *
     * @public
     * @param {Object} config The template configuration
     * @param {string} config.templateDir Required, the template module directory
     * @param {string} [config.srcDir] Source directory, used to compute the template versio key
     * @param {string} [config.modulesSrcDir] Where to get the template LCM modules from
     * @param {string} [config.indexHtml] The index.html file path
     * @param {string} [config.routesJson] The routes.json file path
     * @param {string} [config.labelsJson] The labels.json file path
     * @param {string} [config.themeJson] The theme.json file path
     * @param {string} [config.outputDir] Output dir where resources will be written
     * @param {string} [config.locale] The locale to use
     * @param {string} [config.basePath] The base path to use in branding properties URL values
     */
    async startContext(config) {
        assert(!this.currentContext, "Context already started");

        const context = this.currentContext = new TalonContext(config);

        return folderHash(context.srcDir).then(observable => {
            this.folderHashSubscription = observable.subscribe({
                next(hash) {
                    // include folder mtime so that the returned hash changes
                    // when the folder is touched, this is useful for tests
                    const mtime = fs.statSync(context.srcDir).mtime;

                    const versionKey = crypto.createHash('md5')
                                .update(hash + mtime)
                                .digest("hex")
                                .substring(0, 10);

                    if (!('versionKey' in context) || context.versionKey !== versionKey) {
                        log(`Template version key ${versionKey}`.cyan);
                        context.versionKey = versionKey;
                    }
                }
            });
            return context;
        });
    }

    /**
     * Returns the current context
     * @public
     */
    getContext() {
        assert(this.currentContext, "Context not started");
        return this.currentContext;
    }

    /**
     * Ends the current context and stops watching srcDir for changes.
     * @public
     */
    endContext() {
        assert(this.currentContext, "Context not started");
        this.folderHashSubscription.unsubscribe();
        this.folderHashSubscription = null;
        this.currentContext = null;
    }
}

const instance = autoBind(new ContextService());
const { startContext, getContext, endContext } = instance;
module.exports = { startContext, getContext, endContext, ContextService };