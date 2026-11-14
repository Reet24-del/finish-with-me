/// One finished blocker and the resolution that passed review.
/// Vec is a 256-dimension lexical hash from Finish.Memory.Embed, not a semantic model embedding.
/// SQL name: Finish_Memory.Precedent.
Class Finish.Memory.Precedent Extends %Persistent
{

Property TaskId As %String(MAXLEN = 80);

Property Profile As %String(MAXLEN = 40);

Property Blocker As %String(MAXLEN = 12000);

Property Resolution As %String(MAXLEN = 4000);

Property Vec As %Vector(DATATYPE = "DOUBLE", LEN = 256);

Property CreatedAt As %TimeStamp;

Index TaskIdx On TaskId [ Unique ];

Index ProfileIdx On Profile;

}
