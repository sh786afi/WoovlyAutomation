var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    }
    else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    }
    else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};


//</editor-fold>

app.controller('ScreenshotReportController', function ($scope, $http) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
    }

    this.showSmartStackTraceHighlight = true;

    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };

    this.convertTimestamp = function (timestamp) {
        var d = new Date(timestamp),
            yyyy = d.getFullYear(),
            mm = ('0' + (d.getMonth() + 1)).slice(-2),
            dd = ('0' + d.getDate()).slice(-2),
            hh = d.getHours(),
            h = hh,
            min = ('0' + d.getMinutes()).slice(-2),
            ampm = 'AM',
            time;

        if (hh > 12) {
            h = hh - 12;
            ampm = 'PM';
        } else if (hh === 12) {
            h = 12;
            ampm = 'PM';
        } else if (hh === 0) {
            h = 12;
        }

        // ie: 2013-02-18, 8:35 AM
        time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

        return time;
    };


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };


    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };

    this.applySmartHighlight = function (line) {
        if (this.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return true;
    };

    var results = [
    {
        "description": "TestTestCase 1:-Sign Up with all valid data|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "f347207b89846866219d10ab5c66a0f9",
        "instanceId": 10916,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553497525239,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://alpha.woovly.com/js/loginCommon.js?v=4091 334:8 Uncaught ReferenceError: gapi is not defined",
                "timestamp": 1553497526702,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497532250,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497532251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.102/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553497538959,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.102/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553497538959,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.102/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553497546304,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.102/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553497546304,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553497557866,
                "type": ""
            }
        ],
        "screenShotFile": "00520002-008f-0067-0007-00bc00ab0085.png",
        "timestamp": 1553497523785,
        "duration": 34072
    },
    {
        "description": "TestCase 2:- Sign Up with all valid data expect Invalid email id  |Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "f347207b89846866219d10ab5c66a0f9",
        "instanceId": 10916,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553497558650,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497559559,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497559559,
                "type": ""
            }
        ],
        "screenShotFile": "001f00d9-003f-00a6-00cd-008900c800c8.png",
        "timestamp": 1553497558483,
        "duration": 7814
    },
    {
        "description": "TestCase 3:- Sign Up with all valid data and empty Full name |Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "f347207b89846866219d10ab5c66a0f9",
        "instanceId": 10916,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553497566672,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497567509,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497567509,
                "type": ""
            }
        ],
        "screenShotFile": "009f0018-00b7-007a-00a8-00f1005d007e.png",
        "timestamp": 1553497566504,
        "duration": 5640
    },
    {
        "description": "TestCase 4:- Sign Up with all valid data and empty email id|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "f347207b89846866219d10ab5c66a0f9",
        "instanceId": 10916,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553497572627,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497573571,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497573571,
                "type": ""
            }
        ],
        "screenShotFile": "0057006b-00f0-0010-00b4-00ef003400c1.png",
        "timestamp": 1553497572453,
        "duration": 5648
    },
    {
        "description": "TestCase 5:-Sign Up with all valid data and empty password |Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "f347207b89846866219d10ab5c66a0f9",
        "instanceId": 10916,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553497578563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497579387,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497579387,
                "type": ""
            }
        ],
        "screenShotFile": "0063009f-0071-009f-0099-006a00bc00e8.png",
        "timestamp": 1553497578401,
        "duration": 5598
    },
    {
        "description": "TestCase 6:- Sign Up with all valid data and  empty DOB|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "f347207b89846866219d10ab5c66a0f9",
        "instanceId": 10916,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553497584451,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497585275,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497585275,
                "type": ""
            }
        ],
        "screenShotFile": "007a0082-000b-0012-00d5-0002007700de.png",
        "timestamp": 1553497584291,
        "duration": 5541
    },
    {
        "description": "TestCase 7:- Sign Up with all valid data and already existing email id|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "f347207b89846866219d10ab5c66a0f9",
        "instanceId": 10916,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553497590285,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497590546,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497590546,
                "type": ""
            }
        ],
        "screenShotFile": "00ae0090-0077-0054-0091-00a300fe00d1.png",
        "timestamp": 1553497590125,
        "duration": 5419
    },
    {
        "description": "TestCase 8:-Sign Up with Facebook|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "f347207b89846866219d10ab5c66a0f9",
        "instanceId": 10916,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553497596000,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497596831,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553497596831,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shivam.186/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553497615672,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shivam.186/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553497615672,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553497624881,
                "type": ""
            }
        ],
        "screenShotFile": "00e10061-00ea-0064-0062-00eb00320034.png",
        "timestamp": 1553497595851,
        "duration": 29018
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "2c6d97c1e12a6ebe68a3f1bf3e756b0a",
        "instanceId": 14113,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.fbLogin (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:24:35)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:7:19)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:17:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:16:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e300bf-0015-0056-008b-003e00700078.png",
        "timestamp": 1553500351849,
        "duration": 14
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "2c6d97c1e12a6ebe68a3f1bf3e756b0a",
        "instanceId": 14113,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.fbLogin (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:24:35)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:7:19)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:35:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:34:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b70004-0064-0019-0072-00bb00d4009d.png",
        "timestamp": 1553500351992,
        "duration": 8
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "a41eafacd5819116374c6417d905b501",
        "instanceId": 14369,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.loginSignupLink (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:12:43)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:7:19)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:22:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:21:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0048001c-00f0-00f3-00ae-00e300f500ac.png",
        "timestamp": 1553500443441,
        "duration": 27
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "a41eafacd5819116374c6417d905b501",
        "instanceId": 14369,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.loginSignupLink (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:12:43)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:7:19)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:40:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:39:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "007f0024-0016-002e-0010-00f5004e00d1.png",
        "timestamp": 1553500443605,
        "duration": 16
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "5068c5fe380dd7320c876953fa6d42b0",
        "instanceId": 16274,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.loginSignupLink (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:12:43)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:7:19)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:22:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:21:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "002c0086-008b-007b-001f-00e600b90033.png",
        "timestamp": 1553508325005,
        "duration": 20
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "5068c5fe380dd7320c876953fa6d42b0",
        "instanceId": 16274,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.loginSignupLink (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:12:43)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:7:19)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:40:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:39:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "009700e0-009e-001a-00cf-0096001c00e1.png",
        "timestamp": 1553508325239,
        "duration": 22
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "02c0994d2b43b8d728783260ec226d44",
        "instanceId": 16593,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.loginSignupLink (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:12:43)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:7:19)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:23:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:22:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e200ed-0081-0094-00af-0099002f00cb.png",
        "timestamp": 1553508609024,
        "duration": 28
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "02c0994d2b43b8d728783260ec226d44",
        "instanceId": 16593,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.loginSignupLink (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:12:43)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:7:19)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:41:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:40:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00150065-00dd-003a-009b-00e8008b003f.png",
        "timestamp": 1553508609188,
        "duration": 7
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "b80aff359463ffdd1cc5d1d6e221eb4e",
        "instanceId": 17101,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.loginSignupLink (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:12:43)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:7:19)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:23:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:22:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "005100f5-0090-0055-00ad-00a300cc00c4.png",
        "timestamp": 1553508747307,
        "duration": 17
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "b80aff359463ffdd1cc5d1d6e221eb4e",
        "instanceId": 17101,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.loginSignupLink (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:12:43)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:7:19)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:41:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:40:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00cb0075-004e-009d-00f9-00d5006e00f5.png",
        "timestamp": 1553508747524,
        "duration": 11
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "666c8ab84187396f58c4c6d7119791ae",
        "instanceId": 17360,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:23:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:22:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553508883758,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553508884277,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553508884277,
                "type": ""
            }
        ],
        "screenShotFile": "00230083-00c1-007d-00cb-008f00ec00d2.png",
        "timestamp": 1553508894636,
        "duration": 15
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "666c8ab84187396f58c4c6d7119791ae",
        "instanceId": 17360,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:41:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:40:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b8008d-0007-00a6-0067-008300a600f7.png",
        "timestamp": 1553508894783,
        "duration": 13
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "44cd42001bc96c1f926d5988981b5223",
        "instanceId": 17654,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:23:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:22:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553508942098,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553508942575,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553508942575,
                "type": ""
            }
        ],
        "screenShotFile": "001100bc-005c-0030-0078-009200a600f0.png",
        "timestamp": 1553508953899,
        "duration": 15
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "44cd42001bc96c1f926d5988981b5223",
        "instanceId": 17654,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:41:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:40:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0092006b-00cc-0080-00a1-005f00be0018.png",
        "timestamp": 1553508954048,
        "duration": 12
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "43fe76defc1989c4688b06eb2282b303",
        "instanceId": 17953,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:24:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:23:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509006277,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509012917,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509012917,
                "type": ""
            }
        ],
        "screenShotFile": "007800ef-0016-003c-00c2-001c00400057.png",
        "timestamp": 1553509024202,
        "duration": 17
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "43fe76defc1989c4688b06eb2282b303",
        "instanceId": 17953,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:42:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:41:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "004200fe-00f8-009d-00cb-00e100bf0060.png",
        "timestamp": 1553509024350,
        "duration": 14
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "5ba8e7ed01dbd3d9a39915bef4c959f9",
        "instanceId": 18274,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:24:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:23:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509124429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509127889,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509127889,
                "type": ""
            }
        ],
        "screenShotFile": "000e0002-005a-005e-00ba-004200a50096.png",
        "timestamp": 1553509141201,
        "duration": 15
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "5ba8e7ed01dbd3d9a39915bef4c959f9",
        "instanceId": 18274,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:42:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:41:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/addStoryspec.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a80050-00a1-0035-00d1-000f00730002.png",
        "timestamp": 1553509141319,
        "duration": 15
    },
    {
        "description": "TestTestCase 1:-Sign Up with all valid data|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "28a445ce8544567338afe0fe8a2fd468",
        "instanceId": 18750,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509556081,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509558250,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509558250,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.105/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553509564975,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.105/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553509564975,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.105/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553509572306,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.105/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553509572306,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509583751,
                "type": ""
            }
        ],
        "screenShotFile": "000c0044-0093-008a-006e-00ac004300e1.png",
        "timestamp": 1553509554071,
        "duration": 29671
    },
    {
        "description": "TestCase 2:- Sign Up with all valid data expect Invalid email id  |Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "28a445ce8544567338afe0fe8a2fd468",
        "instanceId": 18750,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509584552,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509585122,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509585122,
                "type": ""
            }
        ],
        "screenShotFile": "002c0015-0053-0099-004f-0018003b0081.png",
        "timestamp": 1553509584397,
        "duration": 7440
    },
    {
        "description": "TestCase 3:- Sign Up with all valid data and empty Full name |Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "28a445ce8544567338afe0fe8a2fd468",
        "instanceId": 18750,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509592241,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509592850,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509592850,
                "type": ""
            }
        ],
        "screenShotFile": "00ba00ee-0010-0018-008b-00be001e0072.png",
        "timestamp": 1553509592077,
        "duration": 5453
    },
    {
        "description": "TestCase 4:- Sign Up with all valid data and empty email id|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "28a445ce8544567338afe0fe8a2fd468",
        "instanceId": 18750,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509597990,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509598557,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509598557,
                "type": ""
            }
        ],
        "screenShotFile": "00bf0062-00ea-001e-005c-006500fd0027.png",
        "timestamp": 1553509597826,
        "duration": 5258
    },
    {
        "description": "TestCase 5:-Sign Up with all valid data and empty password |Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "28a445ce8544567338afe0fe8a2fd468",
        "instanceId": 18750,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509603537,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509604090,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509604090,
                "type": ""
            }
        ],
        "screenShotFile": "00120031-00cc-00c7-003b-004c00240067.png",
        "timestamp": 1553509603383,
        "duration": 5296
    },
    {
        "description": "TestCase 6:- Sign Up with all valid data and  empty DOB|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "28a445ce8544567338afe0fe8a2fd468",
        "instanceId": 18750,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509609120,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509609706,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509609706,
                "type": ""
            }
        ],
        "screenShotFile": "0035003b-0077-0095-00a9-0050007200b6.png",
        "timestamp": 1553509608960,
        "duration": 5241
    },
    {
        "description": "TestCase 7:- Sign Up with all valid data and already existing email id|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "28a445ce8544567338afe0fe8a2fd468",
        "instanceId": 18750,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509614653,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509615303,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509615303,
                "type": ""
            }
        ],
        "screenShotFile": "001200bd-0061-00be-002b-0025008e000f.png",
        "timestamp": 1553509614500,
        "duration": 5266
    },
    {
        "description": "TestCase 8:-Sign Up with Facebook|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "28a445ce8544567338afe0fe8a2fd468",
        "instanceId": 18750,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509620202,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509620863,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509620863,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553509640077,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553509640077,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509649364,
                "type": ""
            }
        ],
        "screenShotFile": "00c800df-00c7-00da-0059-0036001e0016.png",
        "timestamp": 1553509620071,
        "duration": 29285
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "089c3ff8b65f6d1d7947e003f7e17888",
        "instanceId": 19424,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:26:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:25:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553509956140,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509959667,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553509959667,
                "type": ""
            }
        ],
        "screenShotFile": "00b30010-0080-00b6-007a-00f5003b00be.png",
        "timestamp": 1553509969966,
        "duration": 14
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "089c3ff8b65f6d1d7947e003f7e17888",
        "instanceId": 19424,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:44:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:43:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b700d6-0069-00d1-0034-002e001c0080.png",
        "timestamp": 1553509970061,
        "duration": 12
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "733bd664ac62310d097e0de8954dcd93",
        "instanceId": 19844,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:26:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:25:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510287111,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510290625,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510290625,
                "type": ""
            }
        ],
        "screenShotFile": "001d00c0-00ac-0021-0045-00bc00ed0049.png",
        "timestamp": 1553510300898,
        "duration": 14
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "733bd664ac62310d097e0de8954dcd93",
        "instanceId": 19844,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:44:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:43:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00510087-00c8-0073-0048-00c90064006a.png",
        "timestamp": 1553510301051,
        "duration": 13
    },
    {
        "description": "TestTestCase 1:-Sign Up with all valid data|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "79504ee1311743c21757d1d0eddce1e3",
        "instanceId": 20237,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510426934,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510433283,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510433283,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.106/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553510440032,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.106/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553510440032,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.106/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553510447359,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/shafi.106/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553510447359,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510458829,
                "type": ""
            }
        ],
        "screenShotFile": "00b700cd-006b-0030-00b3-00b8001f0040.png",
        "timestamp": 1553510425322,
        "duration": 33498
    },
    {
        "description": "TestCase 2:- Sign Up with all valid data expect Invalid email id  |Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "79504ee1311743c21757d1d0eddce1e3",
        "instanceId": 20237,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510459583,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510460136,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510460136,
                "type": ""
            }
        ],
        "screenShotFile": "00f30057-0082-00d0-00a7-000200970095.png",
        "timestamp": 1553510459446,
        "duration": 7371
    },
    {
        "description": "TestCase 3:- Sign Up with all valid data and empty Full name |Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "79504ee1311743c21757d1d0eddce1e3",
        "instanceId": 20237,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510467205,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510467878,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510467878,
                "type": ""
            }
        ],
        "screenShotFile": "00c300bb-00b8-0031-0096-00c200d10095.png",
        "timestamp": 1553510467071,
        "duration": 5503
    },
    {
        "description": "TestCase 4:- Sign Up with all valid data and empty email id|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "79504ee1311743c21757d1d0eddce1e3",
        "instanceId": 20237,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510473050,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510473685,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510473685,
                "type": ""
            }
        ],
        "screenShotFile": "00eb00f0-00ea-0047-0035-002300e900e1.png",
        "timestamp": 1553510472895,
        "duration": 5297
    },
    {
        "description": "TestCase 5:-Sign Up with all valid data and empty password |Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "79504ee1311743c21757d1d0eddce1e3",
        "instanceId": 20237,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510478661,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510479204,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510479204,
                "type": ""
            }
        ],
        "screenShotFile": "003200ed-005d-00c7-00ea-00bc0018006e.png",
        "timestamp": 1553510478508,
        "duration": 5298
    },
    {
        "description": "TestCase 6:- Sign Up with all valid data and  empty DOB|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "79504ee1311743c21757d1d0eddce1e3",
        "instanceId": 20237,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510484248,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510484808,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510484809,
                "type": ""
            }
        ],
        "screenShotFile": "00a300d3-0054-00f7-0095-0023002b00a9.png",
        "timestamp": 1553510484093,
        "duration": 5186
    },
    {
        "description": "TestCase 7:- Sign Up with all valid data and already existing email id|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "79504ee1311743c21757d1d0eddce1e3",
        "instanceId": 20237,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510489731,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510490327,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510490327,
                "type": ""
            }
        ],
        "screenShotFile": "00090079-007b-00f4-00a8-006e00570031.png",
        "timestamp": 1553510489576,
        "duration": 5248
    },
    {
        "description": "TestCase 8:-Sign Up with Facebook|Sign Up",
        "passed": true,
        "pending": false,
        "os": "Linux",
        "sessionId": "79504ee1311743c21757d1d0eddce1e3",
        "instanceId": 20237,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510495332,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510495906,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510495907,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553510514765,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553510514765,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510523956,
                "type": ""
            }
        ],
        "screenShotFile": "00a50057-00a4-00b4-000d-00c000e3007d.png",
        "timestamp": 1553510495142,
        "duration": 28806
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "6a2bc46c14a94d2754f91d31f0a5ad93",
        "instanceId": 20840,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:26:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:25:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510622407,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510625867,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510625867,
                "type": ""
            }
        ],
        "screenShotFile": "008300ae-00ef-0058-0031-000500e30058.png",
        "timestamp": 1553510636145,
        "duration": 14
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "6a2bc46c14a94d2754f91d31f0a5ad93",
        "instanceId": 20840,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:31:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:44:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:43:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bc0089-009d-0049-0034-003400fc0035.png",
        "timestamp": 1553510636258,
        "duration": 9
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "9ee59a5c862bfdb285471a43d3428bb0",
        "instanceId": 21149,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:32:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:26:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:25:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510741826,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510745240,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510745240,
                "type": ""
            }
        ],
        "screenShotFile": "00f60055-002e-0052-00be-003b00de00d3.png",
        "timestamp": 1553510758540,
        "duration": 16
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "9ee59a5c862bfdb285471a43d3428bb0",
        "instanceId": 21149,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:32:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\n    at UserContext.fn (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:5325:13)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at QueueRunner.execute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4199:10)\n    at queueRunnerFactory (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:44:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:43:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "007d00c1-0034-0010-00d8-00c9003d0042.png",
        "timestamp": 1553510758693,
        "duration": 12
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "07582e20e7bb1eb497f6c11899a9fdb5",
        "instanceId": 21474,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:32:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:26:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:25:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510874908,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510878366,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510878366,
                "type": ""
            }
        ],
        "screenShotFile": "00c8005b-00ac-0090-00cd-00cd00ac000d.png",
        "timestamp": 1553510873088,
        "duration": 18598
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "07582e20e7bb1eb497f6c11899a9fdb5",
        "instanceId": 21474,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, *[id=\"email\"])",
            "Failed: No element found using locator: By(css selector, [onclick=\"add_panel()\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, *[id=\"email\"])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:32:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "NoSuchElementError: No element found using locator: By(css selector, [onclick=\"add_panel()\"])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:44:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:43:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510892246,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510896269,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510896269,
                "type": ""
            }
        ],
        "screenShotFile": "00440053-008b-006e-00fc-003800820021.png",
        "timestamp": 1553510891827,
        "duration": 18054
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "163cff0ef566997ce16aae019c7246e4",
        "instanceId": 21809,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:32:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:26:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:25:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553510983661,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510987168,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553510987168,
                "type": ""
            }
        ],
        "screenShotFile": "00f700f2-00af-00bd-00c7-00b3007a00ee.png",
        "timestamp": 1553510981224,
        "duration": 19227
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "bc87ddcf0c749175ecfbd6a43ea3ca0a",
        "instanceId": 22195,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:32:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:21:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:20:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553511290928,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553511294357,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553511294357,
                "type": ""
            }
        ],
        "screenShotFile": "006f00bb-0018-0030-0032-00e200ae0032.png",
        "timestamp": 1553511289172,
        "duration": 18541
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "bc87ddcf0c749175ecfbd6a43ea3ca0a",
        "instanceId": 22195,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, *[id=\"email\"])",
            "Failed: No element found using locator: By(css selector, [onclick=\"add_panel()\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, *[id=\"email\"])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at browser.getAllWindowHandles.then (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:32:36)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "NoSuchElementError: No element found using locator: By(css selector, [onclick=\"add_panel()\"])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:235:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:39:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:38:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553511308217,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553511311684,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553511311684,
                "type": ""
            }
        ],
        "screenShotFile": "00270025-00d6-0026-0028-006a00f00055.png",
        "timestamp": 1553511307853,
        "duration": 17502
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "eb02d96283c8e4471989002ca500fbd9",
        "instanceId": 22600,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Failed: no such window: window was already closed\n  (Session info: chrome=72.0.3626.96)\n  (Driver info: chromedriver=2.46.628388 (4a34a70827ac54148e092aafb70504c4ea7ae926),platform=Linux 4.4.0-143-generic x86_64)"
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4281:23)\n    at listOnTimeout (timers.js:327:15)\n    at processTimers (timers.js:271:5)",
            "NoSuchWindowError: no such window: window was already closed\n  (Session info: chrome=72.0.3626.96)\n  (Driver info: chromedriver=2.46.628388 (4a34a70827ac54148e092aafb70504c4ea7ae926),platform=Linux 4.4.0-143-generic x86_64)\n    at Object.checkLegacyResponse (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/error.js:546:15)\n    at parseHttpResponse (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at doSend.then.response (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/http.js:441:30)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: WebDriver.findElements(By(css selector, [onclick=\"add_panel()\"]))\n    at thenableWebDriverProxy.schedule (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at thenableWebDriverProxy.findElements (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/webdriver.js:1048:19)\n    at ptor.waitForAngular.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:159:44)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:205:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:21:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Timeout.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4283:11)\n    at listOnTimeout (timers.js:327:15)\n    at processTimers (timers.js:271:5)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:20:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553511537501,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://alpha.woovly.com/js/loginCommon.js?v=4091 334:8 Uncaught ReferenceError: gapi is not defined",
                "timestamp": 1553511538621,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553511546761,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553511546761,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511569615,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511569615,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds - Mixed Content: The page at 'https://alpha.woovly.com/Karan.Xelp/feeds' was loaded over HTTPS, but requested an insecure image 'http://images.woovly.com.s3-website.ap-south-1.amazonaws.com/w_200/0bee40d0-4eed-11e9-9c5a-a3fa69b9dec4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1553511569616,
                "type": ""
            }
        ],
        "screenShotFile": "008f00b0-009c-0063-0072-00c30010008c.png",
        "timestamp": 1553511535777,
        "duration": 33830
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "eb02d96283c8e4471989002ca500fbd9",
        "instanceId": 22600,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //*[@id=\"contHt\"]/div[1]/div[2]/div[9]/div[1]/div[2])",
            "Failed: No element found using locator: By(xpath, //div[@class='row h55 f_m13 f_s13 f_l13 regular icon ic-story inStory poR dark_brd poR createBucket-0'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //*[@id=\"contHt\"]/div[1]/div[2]/div[9]/div[1]/div[2])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.loginSignupLink (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:12:43)\n    at UserContext.beforeEach (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:10:19)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "NoSuchElementError: No element found using locator: By(xpath, //div[@class='row h55 f_m13 f_s13 f_l13 regular icon ic-story inStory poR dark_brd poR createBucket-0'])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at selectDropdown (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:99:27)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:238:11)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:38:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511573163,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511573163,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535115733282 3556 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511573666,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535115733282 3556 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511573666,
                "type": ""
            }
        ],
        "screenShotFile": "00a20027-00d9-00f7-00ed-0085003800bf.png",
        "timestamp": 1553511569927,
        "duration": 4769
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "7ee69154993fd1c88841ddc6b6bb58d8",
        "instanceId": 22915,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[@class='row h55 f_m13 f_s13 f_l13 regular icon ic-story inStory poR dark_brd poR createBucket-0'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[@class='row h55 f_m13 f_s13 f_l13 regular icon ic-story inStory poR dark_brd poR createBucket-0'])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at selectDropdown (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:99:27)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:208:11)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:22:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553511640372,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553511645350,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553511645350,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511667152,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511667152,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535116682782 3556 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511668618,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535116682782 3556 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511668618,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535116682782 - Mixed Content: The page at 'https://alpha.woovly.com/story/15535116682782' was loaded over HTTPS, but requested an insecure image 'http://images.woovly.com.s3-website.ap-south-1.amazonaws.com/w_200/46ab2df0-4eed-11e9-9c5a-a3fa69b9dec4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1553511674356,
                "type": ""
            }
        ],
        "screenShotFile": "003400d8-006b-0017-006f-0060002c00f9.png",
        "timestamp": 1553511638218,
        "duration": 36496
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "7ee69154993fd1c88841ddc6b6bb58d8",
        "instanceId": 22915,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //*[@id=\"contHt\"]/div[1]/div[2]/div[9]/div[1]/div[2])",
            "Failed: No element found using locator: By(xpath, //div[@class='row h55 f_m13 f_s13 f_l13 regular icon ic-story inStory poR dark_brd poR createBucket-0'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //*[@id=\"contHt\"]/div[1]/div[2]/div[9]/div[1]/div[2])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.loginSignupLink (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:12:43)\n    at UserContext.beforeEach (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:10:19)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "NoSuchElementError: No element found using locator: By(xpath, //div[@class='row h55 f_m13 f_s13 f_l13 regular icon ic-story inStory poR dark_brd poR createBucket-0'])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at selectDropdown (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:99:27)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:238:11)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:40:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511678127,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511678128,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535116783796 3556 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511678676,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535116783796 3556 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511678676,
                "type": ""
            }
        ],
        "screenShotFile": "00620096-0095-007f-0039-00a100d60016.png",
        "timestamp": 1553511674927,
        "duration": 4363
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "7b41775459cbad8b1fa899adff93d5c4",
        "instanceId": 23249,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[@class='row h55 f_m13 f_s13 f_l13 regular icon ic-story inStory poR dark_brd poR createBucket-0'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[@class='row h55 f_m13 f_s13 f_l13 regular icon ic-story inStory poR dark_brd poR createBucket-0'])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at selectDropdown (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:99:27)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:208:11)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:22:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553511802574,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553511807129,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553511807129,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://static.xx.fbcdn.net/rsrc.php/v3/yv/r/rMhJpt28Qt8.js 10 WebSocket connection to 'wss://edge-chat.facebook.com/chat' failed: Error during WebSocket handshake: Unexpected response code: 400",
                "timestamp": 1553511820356,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511828937,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511828937,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds - Mixed Content: The page at 'https://alpha.woovly.com/Karan.Xelp/feeds' was loaded over HTTPS, but requested an insecure image 'http://images.woovly.com.s3-website.ap-south-1.amazonaws.com/w_200/a728b7b0-4eed-11e9-9c5a-a3fa69b9dec4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1553511828938,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535118300806 3556 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511830464,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535118300806 3556 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553511830464,
                "type": ""
            }
        ],
        "screenShotFile": "001600d0-00ee-0076-002c-00d1004e0045.png",
        "timestamp": 1553511801181,
        "duration": 30156
    },
    {
        "description": "Case 1:- Create Story & Publish With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "960806d28cc918f05db3d3dbe901c7cb",
        "instanceId": 23878,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[@class='row h55 f_m13 f_s13 f_l13 regular icon ic-story inStory poR dark_brd poR createBucket-0'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[@class='row h55 f_m13 f_s13 f_l13 regular icon ic-story inStory poR dark_brd poR createBucket-0'])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at selectDropdown (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:99:27)\n    at AddStory.Get_New_Story1 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:208:11)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run it(\"Case 1:- Create Story & Publish With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:22:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4091 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553512596387,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553512600998,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553512600998,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553512622836,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/Karan.Xelp/feeds 3551 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553512622836,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535126240238 3556 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553512624303,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535126240238 3556 A parser-blocking, cross site (i.e. different eTLD+1) script, https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.0/jquery-ui.min.js, is invoked via document.write. The network request for this script MAY be blocked by the browser in this or a future page load due to poor network connectivity. If blocked in this page load, it will be confirmed in a subsequent console message. See https://www.chromestatus.com/feature/5718547946799104 for more details.",
                "timestamp": 1553512624303,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/story/15535126240238 - Mixed Content: The page at 'https://alpha.woovly.com/story/15535126240238' was loaded over HTTPS, but requested an insecure image 'http://images.woovly.com.s3-website.ap-south-1.amazonaws.com/w_200/805b2d00-4eef-11e9-9c5a-a3fa69b9dec4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1553512624996,
                "type": ""
            }
        ],
        "screenShotFile": "00b300be-0027-00ca-000b-00eb002a0001.png",
        "timestamp": 1553512594332,
        "duration": 31026
    },
    {
        "description": "Case 2:- Create Story & Save With Existing Bucketlist|Woovly Create Story Module",
        "passed": false,
        "pending": false,
        "os": "Linux",
        "sessionId": "51055fbb9f7ea8d117177c4f496a7177",
        "instanceId": 25238,
        "browser": {
            "name": "chrome",
            "version": "72.0.3626.96"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, *[id=\"newCloseIcon\"])",
            "Failed: No element found using locator: By(css selector, [onclick=\"add_panel()\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, *[id=\"newCloseIcon\"])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as isDisplayed] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as isDisplayed] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at doLogin.offerClose (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/login.js:15:31)\n    at UserContext.beforeEach (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:17:19)\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at shutdownTask_.MicroTask (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:6:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)",
            "NoSuchElementError: No element found using locator: By(css selector, [onclick=\"add_panel()\"])\n    at elementArrayFinder.getWebElements.then (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:814:27)\n    at ManagedPromise.invokeCallback_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at asyncRun (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2927:27)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/next_tick.js:81:5)Error\n    at ElementArrayFinder.applyAction_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/built/element.js:831:22)\n    at clickAdd (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:74:21)\n    at AddStory.Get_New_Story2 (/home/xelpmoc-10/Desktop/Woovly-Automation/pom/addStory.js:238:11)\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:41:21)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:95:18)\nFrom: Task: Run it(\"Case 2:- Create Story & Save With Existing Bucketlist\") in control flow\n    at UserContext.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:40:3)\n    at addSpecsToSuite (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/home/xelpmoc-10/Desktop/Woovly-Automation/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/home/xelpmoc-10/Desktop/Woovly-Automation/spec/specAddStory.js:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://alpha.woovly.com/js/Precommon.js?v=4092 43 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1553515548892,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553515553629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js 2 Mixed Content: The page at 'https://alpha.woovly.com/' was loaded over HTTPS, but requested an insecure image 'http://d3mzj1v5onbwd7.cloudfront.net/staticNew/img/down_arrow_white.svg'. This content should also be served over HTTPS.",
                "timestamp": 1553515553629,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://alpha.woovly.com/js/loginCommon.js?v=4092 511:76 Uncaught TypeError: Cannot read property 'data' of undefined",
                "timestamp": 1553515575722,
                "type": ""
            }
        ],
        "screenShotFile": "00e600f1-00c2-00e7-0027-00bd003a00a1.png",
        "timestamp": 1553515547311,
        "duration": 29457
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    }
                    else
                    {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.sortSpecs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.sortSpecs();
    }


});

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

