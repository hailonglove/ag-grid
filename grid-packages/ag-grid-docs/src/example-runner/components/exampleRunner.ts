import * as angular from "angular";
// @ts-ignore
import * as jQuery from "jquery";

import {trackIfInViewPort, whenInViewPort} from "../lib/viewport";
import {highlight} from "../lib/highlight";

const docs: angular.IModule = angular.module("documentation");

const ACTIVE_EXAMPLE_RUNNERS = [];

class ExampleRunnerController {
    private source: any;
    private loadingSource: boolean;
    private ready: boolean = false;
    private showFrameworksDropdown: boolean;
    private selectedTab: string;

    private selectedFile: string;
    private resultUrl: string;

    private files: string[];
    private title: string;
    private section: string;
    private name: string;
    private type: string;
    private currentType: string;
    private noPlunker: boolean;
    private boilerplateFiles: string[];
    private boilerplatePath: string;
    private sourcePrefix: string;

    private titles: { [key: string]: string; };

    private options: {
        showResult?: boolean;
        initialFile?: string;
        exampleHeight?: number;
    };

    private config: any;

    private iframeStyle: any;

    constructor(
        private $http: angular.IHttpService,
        private $timeout: angular.ITimeoutService,
        private $sce: angular.ISCEService,
        private $q: angular.IQService,
        private formPostData: any,
        private $element: Element,
        // @ts-ignore
        private $cookies: angular.cookies.ICookiesService
    ) {
        $http.defaults.cache = true;
    }

    private availableTypes: string[];

    private openFwDropdown: boolean = false;
    private visible: boolean = false;

    private processVue: boolean = false;

    toggleFwDropdown() {
        this.openFwDropdown = !this.openFwDropdown;
    }

    hideFwDropdown() {
        this.$timeout(() => (this.openFwDropdown = false), 200);
    }

    $onInit() {
        this.iframeStyle = {};

        const options = this.config.options;

        if (options.exampleHeight) {
            this.iframeStyle.height = options.exampleHeight + "px";
        }

        this.selectedTab = options.showResult === false ? "code" : "result";

        this.title = this.config.title;
        this.name = this.config.name;
        this.section = this.config.section;
        this.showFrameworksDropdown = !options.onlyShow && (this.config.type === "multi" || this.config.type === "generated");
        this.availableTypes = options.onlyShow ? [options.onlyShow.toLowerCase()] : Object.keys(this.config.types);

        this.titles = {
            vanilla: "JavaScript",
            react: "React",
            angular: "Angular",
            vue: "Vue"
        };

        const divWrapper = jQuery(this.$element).find("div.example-wrapper");

        this.$timeout(() => {
            let visibleToggle: angular.IPromise<void>;
            let nextVisible: boolean = false;

            trackIfInViewPort(divWrapper, (visible: boolean) => {
                this.$timeout(() => {
                    if (visible && !this.visible) {
                        this.visible = true;
                        ACTIVE_EXAMPLE_RUNNERS.push(this);
                    }
                });
            });
        });

        whenInViewPort(divWrapper, () => {
            this.$timeout(() => {
                this.setType(this.getInitialType());
                this.ready = true;
            });
        });
    }

    getInitialType(): string {
        if (this.config.showOnly) {
            return this.config.showOnly;
        }

        const selectedFramework = this.$cookies.get("agGridFramework");
        const selectedRunnerVersion = this.$cookies.get("agGridRunnerVersion");

        if (this.availableTypes.indexOf(selectedRunnerVersion) > -1) {
            return selectedRunnerVersion;
        } else if (this.availableTypes.indexOf(selectedFramework) > -1) {
            return selectedFramework;
        } else {
            return this.availableTypes[0];
        }
    }

    setAndPersistType(type: string) {
        this.setType(type);
        const tenYearsFromNow = new Date();
        tenYearsFromNow.setFullYear(tenYearsFromNow.getFullYear() + 10);
        this.$cookies.put("agGridRunnerVersion", type, {
            path: "/",
            expires: tenYearsFromNow
        });
    }

    setType(type: string) {
        const typeConfig = this.config.types[type];

        this.boilerplateFiles = typeConfig.boilerplateFiles || [];
        this.boilerplatePath = typeConfig.boilerplatePath;

        const files = typeConfig.files ?
            typeConfig.files.filter((file: string) => {
                return file.indexOf('node_modules') === -1;
            }) :
            typeConfig.files;

        this.files = files[0] === "index.html" ? files : ["index.html"].concat(files);

        this.selectedFile = this.files[1];

        this.resultUrl = typeConfig.resultUrl;

        this.currentType = type;

        this.noPlunker = this.config.options.noPlunker;

        this.loadAllSources();

        this.refreshSource();

        this.openFwDropdown = false;
    }

    private sources: string[];
    private allFiles: any;

    loadAllSources() {
        this.allFiles = this.files.concat(this.boilerplateFiles);

        this.$q
            .all(
                this.allFiles.map((file: string) => {
                    return this.loadSource(file);
                })
            )
            .then((sources: any) => {
                this.sources = sources;
            });
    }

    refreshSource() {
        this.loadingSource = true;
        this.source = this.$sce.trustAsHtml("Loading...");

        this.loadSource(this.selectedFile).then(source => {
            this.loadingSource = false;
            if (!this.selectedFile) {
                throw new Error("We ended up without a selected file :(");
            }
            const extension = this.selectedFile.match(/\.([a-z]+)$/)[1];
            const highlightedSource = highlight(source.trim(), extension);
            this.source = this.$sce.trustAsHtml(highlightedSource);
        });
    }

    loadSource(file: string): angular.IPromise<string> {
        let source = this.getSource(file);
        let sourceUrl;

        if (typeof source === "string") {
            return this.$http.get(source).then((response: angular.IHttpResponse<string>) => {
                return response.data;
            });
        } else {
            const sourcePromises = source.sources.map(source => (source ? this.$http.get(source).then(response => response.data) : ""));
            return this.$q.all(sourcePromises).then(responses => {
                // stupid typescript
                return (<any>source).process(responses);
            });
        }
    }

    getSource(file: string): string | { sources: string[]; process: (string: string) => string; } {
        if (this.boilerplateFiles.indexOf(file) > -1) {
            return [this.boilerplatePath, file].join("/");
        }

        if (file == this.files[0]) {
            return this.resultUrl + "&plunkerView=true";
        } else {
            return this.appFilePath(file);
        }
    }

    sourcesForGeneration(): string[] {
        const vanillaTypes = this.config.types.vanilla.files;

        return [this.appFilePath(vanillaTypes.filter((file: string) => file.endsWith(".js"))[0]), this.appFilePath(vanillaTypes.filter((file: string) => file.endsWith(".html"))[0])];
    }

    appFilePath(file: string) {
        if (!file) {
            return "";
        }

        let endSegment = [file];
        if (this.config.type === "multi") {
            endSegment = [this.currentType, file];
        } else if (this.config.type === "generated") {
            endSegment = ["_gen", this.currentType, file];
        }

        return [this.config.sourcePrefix, this.section, this.name].concat(endSegment).join("/");
    }

    openPlunker(clickEvent: any) {
        const postData: any = {
            "tags[0]": "ag-grid",
            "tags[1]": "example",
            private: true,
            description: this.title
        };

        this.sources.forEach((file: any, index: number) => {
            postData["files[" + this.allFiles[index] + "]"] = file;
        });

        this.formPostData("//plnkr.co/edit/?p=preview", true, postData);
    }

    typeTitle(title: string) {
        return this.titles[title];
    }
}

ExampleRunnerController.$inject = ["$http", "$timeout", "$sce", "$q", "formPostData", "$element", "$cookies"];

docs.component("exampleRunner", {
    template: `
        <div ng-class='["example-runner"]'>

        <div class="framework-chooser" ng-if="$ctrl.showFrameworksDropdown">
            <span> Example version: </span>
            <div ng-class="{ 'btn-group': true, 'open': $ctrl.openFwDropdown }">

    <button type="button"
    ng-click="$ctrl.toggleFwDropdown()"
    ng-blur="$ctrl.hideFwDropdown()"
    class="btn btn-default dropdown-toggle"
    data-toggle="dropdown"
    aria-haspopup="true"
    aria-expanded="false">

    <span ng-class="[ 'runner-item-' + $ctrl.currentType, 'runner-item' ]">{{$ctrl.typeTitle($ctrl.currentType)}} </span>
    <span class="caret"></span>

    </button>

                <ul class="dropdown-menu">
    <li ng-repeat="type in $ctrl.availableTypes">
        <a href="#" ng-click="$ctrl.setAndPersistType(type); $event.preventDefault();" ng-class="['runner-item', 'runner-item-' + type ]">{{$ctrl.typeTitle(type)}}</a>
    </li>
                </ul>
            </div>
        </div>


    <div class="example-wrapper">
        <ul role="tablist" class="primary">
            <li class="title">
                <a href="#example-{{$ctrl.name}}" title="link to {{$ctrl.title}}" id="example-{{$ctrl.name}}"> <i class="fa fa-link" aria-hidden="true"></i> {{$ctrl.title}} </a>
            </li>

            <example-tab
                value="'result'"
                current-value="$ctrl.selectedTab"
                title="'Result'"
                tooltip="'Live Result of the Example'"
                icon="'fa-play'"
                on-click="$ctrl.selectedTab = 'result'">
            </example-tab>

            <example-tab
                value="'code'"
                current-value="$ctrl.selectedTab"
                title="'Code'"
                tooltip="'Examine Example Source Code'"
                icon="'fa-code'"
                on-click="$ctrl.selectedTab = 'code'">
            </example-tab>


            <li role="presentation">
                <a role="tab" ng-href="{{$ctrl.resultUrl}}" target="_blank" title="Open Example in New Tab">
                    <i class="fa fa-arrows-alt" aria-hidden="true"></i> New Tab
                </a>
            </li>

            <example-tab
                ng-hide="$ctrl.noPlunker"
                value="'plunker'"
                current-value="$ctrl.selectedTab"
                title="'Plunker'"
                tooltip="'Open Example in Plunker'"
                icon="'fa-external-link-alt'"
                on-click="$ctrl.openPlunker($event); $event.preventDefault()">
            </example-tab>

        </ul>

        <div class="loading-placeholder" ng-if="!$ctrl.ready" ng-style="$ctrl.iframeStyle">
            <i class="fa fa-spinner fa-pulse fa-3x fa-fw"></i>
        </div>

        <div class="tab-contents" ng-if="$ctrl.ready">
            <div ng-show="$ctrl.selectedTab == 'result'" role="tabpanel" class="result">
                <iframe ng-if="$ctrl.visible" ng-src="{{$ctrl.resultUrl}}" ng-style="$ctrl.iframeStyle" scrolling="no" seamless="true"></iframe>
                <div ng-show="!$ctrl.visible" class="iframe-placeholder" ng-style="$ctrl.iframeStyle">
                    <i class="fa fa-spinner fa-pulse fa-3x fa-fw"></i>
                </div>
            </div>

            <div ng-if="$ctrl.selectedTab == 'code'" role="tabpanel" class="code-browser">
                <ul role="tablist" class="secondary">

                    <li ng-if="$ctrl.boilerplateFiles.length > 0" class="separator">
                         App
                    </li>

                    <example-tab
                        ng-repeat="file in $ctrl.files"
                        value="file"
                        current-value="$ctrl.selectedFile"
                        title="file"
                        icon="'fa-file-code-o'"
                        on-click="$ctrl.selectedFile = file; $ctrl.refreshSource()">
                    </example-tab>

                    <li ng-if="$ctrl.boilerplateFiles.length > 0" class="separator">
                        Framework
                    </li>

                    <example-tab
                        ng-repeat="file in $ctrl.boilerplateFiles"
                        value="file"
                        current-value="$ctrl.selectedFile"
                        title="file"
                        icon="'fa-file-code-o'"
                        on-click="$ctrl.selectedFile = file; $ctrl.refreshSource()">
                    </example-tab>
                </ul>

                <pre><code ng-bind-html="$ctrl.source"></code></pre>
            </div>
        </div>

        </div>
    </div>
    `,
    bindings: {
        config: "<"
    },

    controller: ExampleRunnerController
});
