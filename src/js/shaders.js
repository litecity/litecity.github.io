/* ───────── WebGL：一个着色器、两个缓冲、零贴图 ───────── */
const c3 = $('#c3'), c2 = $('#c2'), g2 = c2.getContext('2d');
const gl = c3.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'low-power' });
const stat = new Mesh(4096), dyn = new Mesh(512);
let prog, progI, UI = {}, vaoI, bufI, U = {}, skyProg, SU = {}, vaoSky, vaoS, vaoD, vaoT, vaoTr, bufS, bufD, bufT, bufTr;
const VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec4 aC;
uniform mat4 uVP; out vec3 vP; out vec3 vN; out vec4 vC;
void main(){ vP=aP; vN=aN; vC=aC; gl_Position=uVP*vec4(aP,1.); }`;
const NOISE = `
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }`;
const FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vP; in vec3 vN; in vec4 vC;
uniform vec3 uSun,uSunC,uSky,uGrid,uEye,uWin,uLit,uWater,uSand,uRock; uniform float uAmb,uAlpha,uFog,uNight,uT,uTc,uFx,uShTex;
uniform vec4 uTa[48]; uniform vec4 uTb[48]; uniform int uTn; uniform sampler2DShadow uSh; uniform mat4 uLVP;
out vec4 o;${NOISE}
float fbm3(vec2 p){ float s=0.,a=.5; for(int i=0;i<3;i++){ s+=a*vn(p); p=p*2.03+17.; a*=.5; } return s; }
float sunVis(vec3 n){                             // 光影：阴影图里查这一点晒不晒得到太阳，再乘上云影
  if(uFx<.5) return 1.;
  float s=1.; vec4 lp=uLVP*vec4(vP+n*uShTex*2.2,1.); vec3 q=lp.xyz*.5+.5;
  if(q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.&&q.z<1.){
    float e=.6/2048.,b=.0016;
    float r=textureLod(uSh,vec3(q.xy+vec2(-e,-e),q.z-b),0.)+textureLod(uSh,vec3(q.xy+vec2(e,-e),q.z-b),0.)+textureLod(uSh,vec3(q.xy+vec2(-e,e),q.z-b),0.)+textureLod(uSh,vec3(q.xy+vec2(e,e),q.z-b),0.);
    s=mix(1.,r*.25,smoothstep(.5,.43,max(abs(q.x-.5),abs(q.y-.5))));
  }
  vec2 W=vP.xz+uSun.xz/max(uSun.y,.2)*(2500.-vP.y);                             // 云投在地上的影子，和天上的云是同一片噪声
  return s*(1.-.5*smoothstep(.47,.72,fbm3(W/2800.+vec2(.004,.0017)*uTc))*(1.-uNight*.6));
}
vec3 light(vec3 n,float sv){ return vec3(uAmb*(.92+.08*n.y))*mix(vec3(1.),uSky*1.12,.3*uFx)+uSunC*((1.-uAmb)*max(dot(n,uSun),0.)*1.15*sv)+n.y*.03; }
float wav(vec2 p){ return vn(p*.085+vec2(uT*.06,uT*.035))+.5*vn(p*.26-vec2(uT*.09,-uT*.05)); }
vec3 water(float dist,float dep,float sv){        // 水：岸边浅而透、中间深而暗；细波扰动法线 → 天色反光、日光高光、碎闪的波光
  vec3 v=normalize(uEye-vP); vec2 p=vP.xz; float near=1.-smoothstep(500.,4000.,dist);
  vec2 g=vec2(wav(p+vec2(.7,0.))-wav(p-vec2(.7,0.)),wav(p+vec2(0.,.7))-wav(p-vec2(0.,.7)))/1.4;
  vec3 nw=normalize(vec3(-g.x*2.2*near,1.,-g.y*2.2*near));
  float fr=pow(1.-max(dot(nw,v),0.),3.);
  vec3 base=mix(mix(uSand,uWater,.58)*1.04,uWater*vec3(.46,.66,.76),dep)*(.93+.1*wav(p*.5)*near);
  base*=uAmb+(1.-uAmb)*(.3+.7*sv);
  vec3 c=mix(base,uSky,.07+.55*fr);
  vec3 hv=normalize(v+uSun); float day=(1.-uNight*.85)*sv;
  float spec=pow(max(dot(nw,hv),0.),220.);
  float gl=vn(p*1.7+uT*.55)*vn(p*3.9-uT*.7);
  float glit=smoothstep(.42,.7,gl)*pow(max(dot(normalize(vec3(-g.x*5.,1.,-g.y*5.)),hv),0.),18.)*(1.-smoothstep(150.,1800.,dist));
  float tw=smoothstep(.5,.78,gl)*(1.-smoothstep(120.,1400.,dist))*(.35+.65*fr);
  return c+(spec*.9+glit*1.3+tw*.55)*uSunC*day;
}
void main(){
  vec3 n=normalize(vN); vec3 c=vC.rgb; float dist=length(vP-uEye); float glow=0.; float lit=1.;
  float fwA=fwidth(vC.a); vec2 gq=vP.xz/16.; vec2 fq=max(fwidth(gq),vec2(1e-5));
  if(vC.a<.35){                                   // 地面与地形：草地、岩石、网格、岸线、水全部按坐标现算
    for(int i=0;i<48;i++){ if(i>=uTn) break;       // 隧道洞身范围内的地形挖掉
      vec2 a=uTa[i].xy, ab=uTa[i].zw-a; float t=clamp(dot(vP.xz-a,ab)/max(dot(ab,ab),1e-4),0.,1.); vec2 d=vP.xz-(a+ab*t);
      if(dot(d,d)<uTb[i].z*uTb[i].z && vP.y<mix(uTb[i].x,uTb[i].y,t)+uTb[i].w) discard; }
    float w=vC.a/.3;
    float grn=clamp((c.g-max(c.r,c.b))*12.,0.,1.);
    vec3 g=c*(.88+.24*vn(vP.xz/260.));                                         // 大片深浅
    g=mix(g,g*vec3(1.14,1.06,.7),smoothstep(.55,.8,vn(vP.xz/38.+3.))*.32);      // 偏黄的草甸斑块
    g=mix(g,g*vec3(.6,.78,.62),smoothstep(.5,.68,vn(vP.xz/95.+11.))*smoothstep(.015,.08,1.-n.y)*step(6.,vP.y)*.3);
    g*=1.+(vn(vP.xz/2.3)-.5)*.3*(1.-smoothstep(60.,500.,dist));                // 近处的草叶颗粒
    c=mix(c,g,grn);
    vec2 a=abs(fract(gq-.5)-.5)/fq;
    c=mix(c,uGrid,(1.-min(min(a.x,a.y),1.))*.5*(1.-smoothstep(250.,900.,dist))*smoothstep(.992,.999,n.y)*(1.-step(.02,w)));
    float rk=smoothstep(.87,.7,n.y)*smoothstep(2.,12.,vP.y)*(1.-smoothstep(.3,.5,w));   // 陡坡露出岩石
    if(rk>.01){
      float nf=1.-smoothstep(400.,3000.,dist);
      float strata=vn(vec2(vP.y*.4+vn(vP.xz*.035)*7.,dot(vP.xz,vec2(.011,.017))));        // 随高度分层的岩层，被水平方向的噪声扭弯
      float crack=abs(vn(vP.xz*.15+vP.y*.06)-.5)*2., fine=vn(vP.xz*.85+vP.y*.6);
      vec3 rc=uRock*(.6+.55*strata)*(1.+(fine-.5)*.34*nf);
      rc=mix(rc,rc*vec3(1.1,.97,.84),vn(vP.xz*.012))*(.55+.45*smoothstep(.03,.22,crack));  // 局部偏黄褐，裂缝处压暗
      c=mix(c,rc,rk); n=normalize(n+vec3(strata-.5,0.,fine-.5)*.9*rk*(.4+.6*nf));          // 岩面凹凸
    }
    float sv=sunVis(n);
    c*=light(n,sv);
    c=mix(c,uSand*(uAmb+.45),smoothstep(.22,.5,w)*.7);                         // 岸边一圈沙
    float e=fwA/.3*.75+1e-4;
    vec3 wc=water(dist,smoothstep(.5,.96,w),sv);
    wc=mix(wc,vec3(.9,.94,.95)*(uAmb+.4),smoothstep(.5,.525,w)*(1.-smoothstep(.525,.6,w))*(.35+.65*vn(vP.xz*.45+uT*.15))*.4);   // 贴岸的一线浅沫
    c=mix(c,wc,smoothstep(.5-e,.5+e,w)); lit=0.;
  } else if(vC.a>.7 && vC.a<.9){ c=water(dist,.8,sunVis(vec3(0.,1.,0.))); lit=0.; }
  else if(vC.a>.92 && vC.a<.97){ c=mix(vec3(.9,.92,.93),c,.25+.75*uNight); lit=0.; }        // 发光面：路灯灯头、隧道灯带
  else if(vC.a<.6 && abs(n.y)<.5){               // 带窗墙面：窗格按位置现算，不占贴图
    vec2 t=normalize(vec2(-n.z,n.x)); float u=dot(vP.xz,t)/3.; float v=vP.y/3.2;
    float fu=fract(u), fv=fract(v);
    float w=step(.2,fu)*step(fu,.8)*step(.28,fv)*step(fv,.78)*(1.-smoothstep(350.,900.,dist));
    float on=step(.62,fract(sin(floor(u)*12.9898+floor(v)*78.233)*43758.5453));
    c=mix(c,uWin,w*.8); glow=w*on*uNight;
  }
  if(lit>.5) c*=light(n,sunVis(n));
  c=mix(c,uLit,glow);
  c=mix(c,uSky,smoothstep(uFog*.25,uFog,dist)*.6);   // 只是远处的薄雾，不把山藏掉
  o=vec4(c,uAlpha);
}`;
const SKY_VS = `#version 300 es
out vec2 vU; void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); vU=p*2.-1.; gl_Position=vec4(vU,0.,1.); }`;
const SKY_FS = `#version 300 es
precision highp float;
in vec2 vU; uniform vec3 uR,uUp,uF,uZen,uHor,uCloud,uEye,uSunD,uMoonD,uSunC; uniform float uTan,uAsp,uTc,uNight,uPh; out vec4 o;${NOISE}
float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+17.; a*=.5; } return s; }
void main(){                                      // 天空：渐变、星星、太阳、带月相的月亮、一层会随风移动的云，全是算出来的
  vec3 d=normalize(uF+uR*vU.x*uTan*uAsp+uUp*vU.y*uTan);
  vec3 c=d.y>0. ? mix(uHor,uZen,pow(d.y,.5)) : mix(uHor,uHor*.72,clamp(-d.y*4.,0.,1.));
  if(uNight>.02 && d.y>0.){                        // 星星：把天球切成小格，少数格子里放一颗
    vec2 sp=vec2(atan(d.z,d.x),asin(d.y))*150.; vec2 id=floor(sp);
    vec2 f=fract(sp)-.5+(vec2(hash(id+1.7),hash(id+9.1))-.5)*.6;
    c+=vec3(.9,.95,1.)*step(.93,hash(id+.5))*smoothstep(.16,.02,length(f))*uNight*(.35+.65*hash(id+4.2))*smoothstep(0.,.2,d.y);
  }
  float sd=max(dot(d,uSunD),0.), up=smoothstep(-.06,.02,uSunD.y);
  c+=vec3(1.,.93,.78)*(smoothstep(.99985,.99996,sd)*2.+pow(sd,900.)*.9+pow(sd,26.)*.16)*up;
  float md=dot(d,uMoonD), mr=.03;
  c+=vec3(.5,.6,.8)*pow(max(md,0.),300.)*.22*uNight*step(-.05,uMoonD.y);
  if(md>cos(mr*1.02) && uMoonD.y>-.05){            // 月亮：圆盘上朝太阳的一侧是亮的，明暗分界线由月相决定
    vec3 mx=normalize(cross(vec3(0.,1.,0.),uMoonD)), my=cross(uMoonD,mx);
    vec2 q=vec2(dot(d,mx),dot(d,my))/sin(mr), sdr=vec2(dot(uSunD,mx),dot(uSunD,my)); sdr/=max(length(sdr),1e-4);
    float xs=dot(q,sdr), ys=dot(q,vec2(-sdr.y,sdr.x));
    float litm=smoothstep(-.06,.06,xs-cos(uPh)*sqrt(max(1.-ys*ys,0.)));
    vec3 mc=vec3(.94,.94,.87)*(.8+.2*vn(q*3.+7.));
    c=mix(c,mix(c+vec3(.025),mc,litm),smoothstep(1.,.93,length(q))*(.4+.6*uNight));
  }
  if(d.y>.012){
    vec2 p=(uEye.xz+d.xz/d.y*(2500.-uEye.y))/2800.+vec2(.004,.0017)*uTc;        // 云在 2500 m 高的一层上，地面的云影用同一张图
    float cl=smoothstep(.47,.72,fbm(p))*smoothstep(.012,.14,d.y);
    vec3 cc=uCloud*(.76+.24*smoothstep(.3,.7,fbm(p*1.7+3.)))+uSunC*pow(sd,5.)*.12*up;
    c=mix(c,cc,cl*.93);
  }
  o=vec4(c,1.);
}`;
const VS_I = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=3) in vec4 aI; layout(location=4) in vec4 aK;
uniform mat4 uVP; out vec3 vP; out vec3 vN; out vec4 vC;
void main(){                                      // 人和车：一个单位盒子按实例放大、转向、平移。种类 0 车身、1 车窗、2 行人
  float k=floor(aK.a*255.+.5);
  vec3 sz=k<.5 ? vec3(4.4,.8,1.9) : k<1.5 ? vec3(2.3,.62,1.7) : vec3(.5,1.7,.5);
  vec3 q=aP*sz; q.y+=k<.5 ? .25 : k<1.5 ? 1.05 : 0.; if(k>.5&&k<1.5) q.x-=.35;
  float c=cos(aI.w), s=sin(aI.w);
  vP=vec3(q.x*c-q.z*s,q.y,q.x*s+q.z*c)+aI.xyz; vN=vec3(aN.x*c-aN.z*s,aN.y,aN.x*s+aN.z*c); vC=vec4(aK.rgb,1.);
  gl_Position=uVP*vec4(vP,1.);
}`;
const SH_VS = `#version 300 es
layout(location=0) in vec3 aP; uniform mat4 uVP; void main(){ gl_Position=uVP*vec4(aP,1.); }`;
const SH_FS = `#version 300 es
precision highp float; void main(){}`;
