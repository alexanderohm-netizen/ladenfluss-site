/* Cost model for Personalfluss. Estimates only; no payroll calculations.
 * Employer overhead is a user-supplied flat approximation; no automatic
 * social insurance, legal supplements, holiday pay or paid leave assumptions.
 */
(function(root){
  'use strict';
  const WEEKS_PER_MONTH=52/12;
  function nonNegative(number){
    const value=Number(number);
    return Number.isFinite(value)&&value>=0?value:null;
  }
  function summarize({team=[],shifts={},rates={},planning={},shiftHours}){
    if(!Array.isArray(team)||!rates||typeof rates!=='object'||Array.isArray(rates)||
       typeof shiftHours!=='function'||!shifts||typeof shifts!=='object')
      throw new Error('Personalkosten können nicht sicher berechnet werden.');
    const pct=nonNegative(planning.overheadPct);
    const budget=planning.monthlyBudget===null?null:nonNegative(planning.monthlyBudget);
    if(pct===null||pct>100||(budget!==null&&budget>10000000))
      throw new Error('Arbeitgeberaufschlag und Monatsbudget prüfen.');
    const factor=1+pct/100;
    const rows=[];
    const knownIds=new Set();
    let grossMonth=0,grossPlanWeek=0,missingShifts=0;
    for(const person of team){
      if(!person||typeof person.id!=='string'||knownIds.has(person.id))
        throw new Error('Teamzuordnung ist nicht eindeutig.');
      knownIds.add(person.id);
      const hours=nonNegative(person.hours);
      if(hours===null||hours>60)throw new Error('Sollstunden im Mitarbeiterprofil prüfen.');
      const rate=Object.hasOwn(rates,person.id)?rates[person.id]:null;
      if(rate!==null&&(!Number.isFinite(rate)||rate<0||rate>250))
        throw new Error('Brutto-Stundenlohn ungültig.');
      const week=Array.isArray(shifts[person.id])?shifts[person.id]:[];
      let plannedHours=0;
      for(const shift of week.slice(0,7)){
        if(shift==null)continue;
        const value=shiftHours(shift);
        if(!Number.isFinite(value)||value<=0){missingShifts++;continue;}
        plannedHours+=value;
      }
      const personGrossMonth=rate===null?null:hours*rate*WEEKS_PER_MONTH;
      const personGrossPlanned=rate===null?null:plannedHours*rate;
      if(personGrossMonth!==null)grossMonth+=personGrossMonth;
      if(personGrossPlanned!==null)grossPlanWeek+=personGrossPlanned;
      rows.push({
        id:person.id,name:String(person.name||'Mitarbeitende'),
        rate,contractHours:hours,plannedHours,
        monthlyGross:personGrossMonth,monthlyEmployer:personGrossMonth===null?null:personGrossMonth*factor,
        plannedGross:personGrossPlanned,plannedEmployer:personGrossPlanned===null?null:personGrossPlanned*factor
      });
    }
    const missing=rows.filter(r=>r.rate===null).map(r=>r.id);
    const complete=team.length>0&&missing.length===0;
    const employerMonth=grossMonth*factor,employerPlanWeek=grossPlanWeek*factor;
    const budgetDifference=complete&&budget!==null?budget-employerMonth:null;
    return {
      rows,totalEmployees:rows.length,priced:rows.length-missing.length,missing,
      complete,budget,overheadPct:pct,monthlyGross:grossMonth,
      monthlyEmployer:employerMonth,plannedGross:grossPlanWeek,
      plannedEmployer:employerPlanWeek,budgetDifference,
      budgetExceeded:budgetDifference!==null&&budgetDifference< -0.005,
      invalidShiftCount:missingShifts
    };
  }
  root.LadenflussStaffCosts=Object.freeze({summarize,WEEKS_PER_MONTH});
})(window);
