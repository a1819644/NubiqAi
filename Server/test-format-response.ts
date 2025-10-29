import { formatResponse } from "./services/responseFormatter";

const fence = "```";
const sample1 = [
    "Here's a C code example for \"Hello, World!\" :",
    "",
    fence,
    "#include <stdio.h>",
    "",
    "int main() {",
    "    printf(\"Hello, World!\\n\");",
    "    return 0;",
    "}",
    fence,
    "",
    "💡 How to use it:",
    "",
    "1.",
    "Save the code: Open a plain text editor (like Notepad on Windows, TextEdit on Mac, or any code editor) and copy-paste the code above into it. Save the file with a",
    ".c",
    "extension, for example,",
    "hello.c",
    ".",
    "",
    "Key Points:",
    "• `#include <stdio.h>` : This line is a preprocessor directive.",
    "• `int main()` : Entry point of every C program.",
    "• `printf` : Prints to the console.",
    "• `\\n` : Newline character.",
].join("\n");

const sample2 = [
    ". Make sure the \"Save as type\" is \"All Files\" if you're using a basic editor like Notepad, to avoid it saving as",
    ".txt",
    ".",
    "4. Open in Browser: Locate the saved",
    "hello.html",
    "",
    "file on your computer and double-click it. It should automatically open in your default web browser (like Chrome, Firefox, Edge, or Safari), displaying \"Hello World!\" as a large heading.",
    "",
    "🔑 Key Points:",
    "",
    "•",
    "<!DOCTYPE html>",
    ": This declaration defines that this document is an HTML5 document. It's crucial for browsers to render the page correctly.",
    "•",
    "<html>",
    ": This is the root element of an HTML page. All other HTML elements are contained within it.",
    "•",
    "<head>",
    ": This section contains meta-information about the HTML document, such as its title, links to stylesheets, and scripts. The content here is generally not directly visible on the page.",
    "•",
    "<title>",
    ": The text inside the",
    "<title>",
    "tags (",
    "Hello World Page",
    "in this case) appears in the browser's tab or window title bar.",
].join("\n");

const sample3 = [
    "🔑 Key Points:",
    "",
    "•",
    "`GenerativeModel(...)`",
    ": This is where you specify which model you want to use.",
    "•",
    "`generate_content(...)`",
    ": This is the function that sends your prompt to the model and gets the response.",
].join("\n");

console.log("==== SAMPLE 1 ====");
const out1 = formatResponse(sample1, { emojiEnabled: true, tone: "playful" });
console.log(out1);

console.log("\n\n==== SAMPLE 2 ====");
const out2 = formatResponse(sample2, { emojiEnabled: true, tone: "playful" });
console.log(out2);

console.log("\n\n==== SAMPLE 3 (Inline Code) ====");
const out3 = formatResponse(sample3, { emojiEnabled: true, tone: "playful" });
console.log(out3);

