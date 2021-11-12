var mobile_save_textarea = document.getElementById("mobile_save");
var json_textarea = document.getElementById("json");
var pako = require('pako');
var startingString = "AntimatterDimensionsAndroidSaveFormat";
var endingString = "EndOfSavefile";

function onMobileSaveInput() {
    var mobile_save = mobile_save_textarea.value;
    
    if (mobile_save === "") {
        json_textarea.value = "";
    } else {
        var base64_string = "";
        if (mobile_save.startsWith(startingString)) {
            const trimmed = mobile_save.substring(startingString.length + 3).slice(0, -endingString.length);
            base64_string = trimmed.replace(/0c/g, "/").replace(/0b/g, "+").replace(/0a/g, "0")
        } else {
            base64_string = mobile_save.replace(/\-/g, "+").replace(/\_/g, "/");
        }
        const uintArray = Base64Binary.decode(base64_string);  
        const output = pako.ungzip(uintArray, { to: 'string' });
        json_textarea.value = output;
    }
}

function onJsonInput() {
    const json = json_textarea.value;

    if (json === "") {
        mobile_save_textarea.value = "";
    } else {
        const gzipped_json = pako.gzip(json);
        mobile_save_textarea.value = _arrayBufferToBase64(gzipped_json).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }
}

function _arrayBufferToBase64( buffer ) {
    var binary = '';
    const bytes = new Uint8Array( buffer );
    const len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}