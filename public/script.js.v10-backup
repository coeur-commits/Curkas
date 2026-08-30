async function generateCode(){
const number=document.getElementById('number').value;

if(!number){
alert('Entre un numéro');
return;
}

document.getElementById('result').innerHTML='Loading...';

try{
const res=await fetch('/pair?number='+number);
const data=await res.json();

if(data.code){
document.getElementById('result').innerHTML=data.code;
}else{
document.getElementById('result').innerHTML='ERROR';
}
}catch(e){
document.getElementById('result').innerHTML='SERVER ERROR';
}
}
