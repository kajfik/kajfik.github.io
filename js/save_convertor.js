var mobile_save_textarea = document.getElementById("mobile_save");
var json_textarea = document.getElementById("json");
var pako = require('pako');

function onMobileSaveInput() {
    var mobile_save = mobile_save_textarea.value;
    
    if (mobile_save === "") {
        json_textarea.value = "";
    } else {
        var base64_string = mobile_save.replace(/\-/g, "+").replace(/\_/g, "/");
        var uintArray = Base64Binary.decode(base64_string);  
        var output = pako.ungzip(uintArray, { to: 'string' });
        json_textarea.value = output;
    }
    
}

function onJsonInput() {
    var json = json_textarea.value;

    if (json === "") {
        mobile_save_textarea.value = "";
    } else {
        var gzipped_json = pako.gzip(json);

        mobile_save_textarea.value = _arrayBufferToBase64(gzipped_json).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }
}

function _arrayBufferToBase64( buffer ) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}