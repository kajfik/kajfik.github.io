var lower_bound_textarea = document.getElementById("lowerBound");
var upper_bound_textarea = document.getElementById("upperBound");
var attack_speed_select = document.getElementById("attackSpeed");
var dps_div = document.getElementById("dps");

function onInput() {
    var lower_bound = parseFloat(lower_bound_textarea.value);
    var upper_bound = parseFloat(upper_bound_textarea.value);
    var attack_speed = parseFloat(attack_speed_select.value);
    dps_div.textContent = (attack_speed * (lower_bound + upper_bound) / 2.0).toFixed(2);
}