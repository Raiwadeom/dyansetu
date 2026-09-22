/* ============================================================================
   DnyanSetu — Question bank registry

   Every bank module exports { beginner, intermediate, advanced }, each an array
   of [prompt, optA, optB, optC, optD, correctIndex] tuples.

   Subjects taught in more than one stream (Programming in C appears in both
   B.Sc. CS and BCA) deliberately share a single bank under shared/.

   A subject listed here without a module resolves to empty arrays, so the
   engine reports the shortfall instead of breaking the page.
   ========================================================================== */

import physics1 from "./bsc/physics-1.js";
import physics2 from "./bsc/physics-2.js";
import physics3 from "./bsc/physics-3.js";
import chemistry1 from "./bsc/chemistry-1.js";
import chemistry2 from "./bsc/chemistry-2.js";
import chemistry3 from "./bsc/chemistry-3.js";

import cProgramming from "./shared/c-programming.js";
import computerFundamentals from "./shared/computer-fundamentals.js";
import dataStructures from "./shared/data-structures.js";
import dbms from "./shared/dbms.js";
import operatingSystems from "./shared/operating-systems.js";
import computerNetworks from "./shared/computer-networks.js";
import softwareEngineering from "./shared/software-engineering.js";

import discreteMathematics from "./bsc-cs/discrete-mathematics.js";
import webDesign from "./bsc-cs/web-design.js";
import oopCpp from "./bsc-cs/oop-cpp.js";
import pythonDataScience from "./bsc-cs/python-data-science.js";
import tocAlgorithms from "./bsc-cs/toc-algorithms.js";

import computingMathematics from "./bca/computing-mathematics.js";
import webTechnology from "./bca/web-technology.js";
import javaProgramming from "./bca/java-programming.js";
import pythonProgramming from "./bca/python-programming.js";
import algorithms from "./bca/algorithms.js";

import financialAccounting from "./bcom/financial-accounting.js";
import businessEconomics from "./bcom/business-economics.js";
import businessOrganisation from "./bcom/business-organisation.js";
import businessMathematics from "./bcom/business-mathematics.js";
import corporateAccounting from "./bcom/corporate-accounting.js";
import businessLaw from "./bcom/business-law.js";
import costAccounting from "./bcom/cost-accounting.js";
import bankingInsurance from "./bcom/banking-insurance.js";
import incomeTaxGst from "./bcom/income-tax-gst.js";
import auditing from "./bcom/auditing.js";
import managementAccounting from "./bcom/management-accounting.js";
import entrepreneurship from "./bcom/entrepreneurship.js";

const EMPTY = { beginner: [], intermediate: [], advanced: [] };

/* Normalises a module (or a missing one) into the three-level shape. */
function bank(mod) {
  if (!mod) return EMPTY;
  return {
    beginner: mod.beginner || [],
    intermediate: mod.intermediate || [],
    advanced: mod.advanced || [],
  };
}

/* streamId -> subjectId -> bank. Subject ids match curriculum.js. */
const BANKS = {
  bsc: {
    "physics-1": bank(physics1),
    "chemistry-1": bank(chemistry1),
    "physics-2": bank(physics2),
    "chemistry-2": bank(chemistry2),
    "physics-3": bank(physics3),
    "chemistry-3": bank(chemistry3),
  },
  "bsc-cs": {
    "c-programming": bank(cProgramming),
    "computer-fundamentals": bank(computerFundamentals),
    "discrete-mathematics": bank(discreteMathematics),
    "web-design": bank(webDesign),
    "data-structures": bank(dataStructures),
    "oop-cpp": bank(oopCpp),
    dbms: bank(dbms),
    "operating-systems": bank(operatingSystems),
    "computer-networks": bank(computerNetworks),
    "software-engineering": bank(softwareEngineering),
    "python-data-science": bank(pythonDataScience),
    "toc-algorithms": bank(tocAlgorithms),
  },
  bca: {
    "c-programming": bank(cProgramming),
    "computer-fundamentals": bank(computerFundamentals),
    "computing-mathematics": bank(computingMathematics),
    "web-technology": bank(webTechnology),
    "data-structures": bank(dataStructures),
    dbms: bank(dbms),
    "operating-systems": bank(operatingSystems),
    "java-programming": bank(javaProgramming),
    "computer-networks": bank(computerNetworks),
    "software-engineering": bank(softwareEngineering),
    "python-programming": bank(pythonProgramming),
    algorithms: bank(algorithms),
  },
  bcom: {
    "financial-accounting": bank(financialAccounting),
    "business-economics": bank(businessEconomics),
    "business-organisation": bank(businessOrganisation),
    "business-mathematics": bank(businessMathematics),
    "corporate-accounting": bank(corporateAccounting),
    "business-law": bank(businessLaw),
    "cost-accounting": bank(costAccounting),
    "banking-insurance": bank(bankingInsurance),
    "income-tax-gst": bank(incomeTaxGst),
    auditing: bank(auditing),
    "management-accounting": bank(managementAccounting),
    entrepreneurship: bank(entrepreneurship),
  },
};

export default BANKS;
