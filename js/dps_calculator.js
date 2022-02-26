var lower_bound_textarea = document.getElementById("lowerBound");
var upper_bound_textarea = document.getElementById("upperBound");
var attack_speed_select = document.getElementById("attackSpeed");
var dps_div = document.getElementById("dps");

var lower_bound_textarea2 = document.getElementById("lowerBound2");
var upper_bound_textarea2 = document.getElementById("upperBound2");
var attack_speed_select2 = document.getElementById("attackSpeed2");
var dps_div2 = document.getElementById("dps2");

function onInput() {
    var lower_bound = parseFloat(lower_bound_textarea.value);
    var upper_bound = parseFloat(upper_bound_textarea.value);
    var attack_speed = parseFloat(attack_speed_select.value);
    dps_div.textContent = (attack_speed * (lower_bound + upper_bound) / 2.0).toFixed(2);
}

function onInput2() {
    var lower_bound = parseFloat(lower_bound_textarea2.value);
    var upper_bound = parseFloat(upper_bound_textarea2.value);
    var attack_speed = parseFloat(attack_speed_select2.value);
    dps_div2.textContent = (attack_speed * (lower_bound + upper_bound) / 2.0).toFixed(2);
}