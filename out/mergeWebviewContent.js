"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMergeWebviewContent = getMergeWebviewContent;
const webviewContent_1 = require("./webviewContent");
function getMergeWebviewContent(webview, defaultWorkspacePath = '') {
    return (0, webviewContent_1.getWebviewContent)(webview, defaultWorkspacePath);
}
//# sourceMappingURL=mergeWebviewContent.js.map