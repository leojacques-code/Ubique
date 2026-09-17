const prompt =
  "Classe un message entrant: APPLICATION_CONFIRMATION, RECRUITER_REPLY, INTERVIEW_INVITE, CASE_STUDY, ONLINE_TEST, REQUEST_FOR_INFORMATION, FOLLOW_UP, REJECTION, OFFER, NETWORK_REPLY, JOB_ALERT, OTHER. Retourne applicationId uniquement si correspondance certaine au poste/référence/fil. Une société seule ne suffit pas si plusieurs postes. Si ambigu: applicationId vide et confidence faible. Ne confonds pas invitation à candidater et entretien. JOB_ALERT ne modifie jamais statut.";

export default prompt;
