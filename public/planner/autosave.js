export class Autosave{
 constructor(save,status,delay=1500){this.save=save;this.status=status;this.delay=delay;this.dirty=false;this.running=null;this.timer=null;}
 touch(){this.dirty=true;this.status('Saving…');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush().catch(()=>{}),this.delay);}
 get pending(){return this.dirty||!!this.running;}
 async flush(){
  clearTimeout(this.timer);
  if(this.running){await this.running;if(this.dirty)return this.flush();return;}
  if(!this.dirty)return;
  this.dirty=false;this.status('Saving…');
  this.running=Promise.resolve().then(()=>this.save()).then(()=>this.status('Saved')).catch(error=>{this.dirty=true;this.status('Not saved · '+error.message);throw error;}).finally(()=>{this.running=null;});
  await this.running;if(this.dirty)return this.flush();
 }
 reset(){clearTimeout(this.timer);this.dirty=false;}
}
